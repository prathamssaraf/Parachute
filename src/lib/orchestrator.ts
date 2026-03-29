import * as Y from 'yjs'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentRegistration {
  runId: string
  clientId: number
  userName: string
  userColor: string
  targetFile: string
  assignedFile: string
  flow: 'primary' | 'detour' | 'integrator'
  status: 'running' | 'redirected' | 'done'
  startedAt: number
}

export interface OrchestratorEvent {
  id: string
  time: string
  type: 'info' | 'warning' | 'success' | 'conflict'
  agent: string
  agentColor: string
  msg: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function uid(): string { return Math.random().toString(36).slice(2, 9) }
function getTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ─── Registry: agents register/unregister via Y.Map('orchestrator') ─────────

function getRegistry(doc: Y.Doc): Y.Map<any> {
  return doc.getMap('orchestrator')
}

function getEventLog(doc: Y.Doc): Y.Array<OrchestratorEvent> {
  return doc.getArray('orchestrator-events') as Y.Array<OrchestratorEvent>
}

export function registerAgent(doc: Y.Doc, reg: AgentRegistration): void {
  doc.transact(() => {
    getRegistry(doc).set(reg.runId, reg)
  })
}

export function unregisterAgent(doc: Y.Doc, runId: string): void {
  const reg = getRegistry(doc).get(runId) as AgentRegistration | undefined
  if (reg) {
    doc.transact(() => {
      getRegistry(doc).set(runId, { ...reg, status: 'done' })
    })
  }
}

// ─── Broadcast an orchestrator event to all clients ─────────────────────────

export function broadcastEvent(doc: Y.Doc, type: OrchestratorEvent['type'], agent: string, agentColor: string, msg: string): void {
  const event: OrchestratorEvent = {
    id: uid(),
    time: getTime(),
    type,
    agent,
    agentColor,
    msg,
  }
  doc.transact(() => {
    const log = getEventLog(doc)
    log.push([event])
    // Keep last 100 events
    while (log.length > 100) log.delete(0, 1)
  })
}

// ─── Conflict detection: find overlapping agents on the same file ───────────

export function detectConflicts(doc: Y.Doc): {
  hasConflict: boolean
  conflictWith?: AgentRegistration
  suggestedFile?: string
  suggestedFlow?: 'detour' | 'integrator'
} {
  const registry = getRegistry(doc)
  const active: AgentRegistration[] = []

  registry.forEach((val) => {
    const reg = val as AgentRegistration
    if (reg.status === 'running') active.push(reg)
  })

  if (active.length < 2) return { hasConflict: false }

  // Group by file
  const byFile = new Map<string, AgentRegistration[]>()
  for (const a of active) {
    const list = byFile.get(a.assignedFile) || []
    list.push(a)
    byFile.set(a.assignedFile, list)
  }

  // Check each file for multiple agents
  for (const [file, agents] of byFile) {
    if (agents.length <= 1) continue
    // Sort by startedAt — first arrival wins
    agents.sort((a, b) => a.startedAt - b.startedAt)
    const owner = agents[0]
    const latecomer = agents[agents.length - 1]

    // Find a free file to redirect to
    const allFiles = new Set<string>()
    registry.forEach((val) => {
      const r = val as AgentRegistration
      if (r.status === 'running') allFiles.add(r.assignedFile)
    })
    const alternatives = ['middleware.ts', 'auth.ts', 'tests.ts', 'README.md', 'schema.ts', 'routes.ts'].filter(f => !allFiles.has(f))
    const alt = alternatives[0] || 'middleware.ts'

    return {
      hasConflict: true,
      conflictWith: owner,
      suggestedFile: alt,
      suggestedFlow: active.length >= 3 ? 'integrator' : 'detour',
    }
  }

  // No file overlap, but 3+ agents → third becomes integrator
  if (active.length >= 3) {
    return {
      hasConflict: false,
      suggestedFlow: 'integrator',
    }
  }

  return { hasConflict: false }
}

// ─── Determine flow for a new agent based on current state ──────────────────

export function determineFlow(doc: Y.Doc, targetFile: string, agentName: string): {
  flow: 'primary' | 'detour' | 'integrator'
  assignedFile: string
  lockedBy?: string
} {
  const registry = getRegistry(doc)
  const meta = doc.getMap('agent-meta')
  const lockFile = (meta.get('lockFile') as string) || ''
  const lockOwner = (meta.get('lockOwner') as string) || ''

  // Count active agents
  const active: AgentRegistration[] = []
  registry.forEach((val) => {
    const reg = val as AgentRegistration
    if (reg.status === 'running') active.push(reg)
  })

  // Check if someone is already working on the same file
  const fileOwner = active.find(a => a.assignedFile === targetFile)
  const fileLocked = lockFile === targetFile && lockOwner !== agentName

  if (fileOwner || fileLocked) {
    // File is taken — find alternative
    const busyFiles = new Set(active.map(a => a.assignedFile))
    if (lockFile) busyFiles.add(lockFile)
    const alternatives = ['middleware.ts', 'auth.ts', 'tests.ts', 'README.md', 'schema.ts', 'routes.ts']
      .filter(f => !busyFiles.has(f) && f !== targetFile)
    const alt = alternatives[0] || 'middleware.ts'

    return {
      flow: active.length >= 2 ? 'integrator' : 'detour',
      assignedFile: alt,
      lockedBy: fileOwner?.userName || lockOwner,
    }
  }

  // No conflict
  if (active.length === 0) {
    return { flow: 'primary', assignedFile: targetFile }
  } else if (active.length === 1) {
    return { flow: 'detour', assignedFile: targetFile }
  } else {
    return { flow: 'integrator', assignedFile: targetFile }
  }
}

// ─── Subscribe to orchestrator events (all clients see these) ───────────────

export function observeOrchestratorEvents(
  doc: Y.Doc,
  onEvent: (event: OrchestratorEvent) => void
): () => void {
  const log = getEventLog(doc)

  // Emit existing events on subscribe
  for (let i = 0; i < log.length; i++) {
    onEvent(log.get(i))
  }

  const observer = (e: Y.YArrayEvent<OrchestratorEvent>) => {
    for (const delta of e.changes.delta) {
      if ('insert' in delta && delta.insert) {
        for (const item of delta.insert as OrchestratorEvent[]) {
          onEvent(item)
        }
      }
    }
  }
  log.observe(observer)
  return () => log.unobserve(observer)
}

// ─── Watch for agent status changes (for presence panel) ────────────────────

export function observeAgentRegistry(
  doc: Y.Doc,
  onChange: (agents: AgentRegistration[]) => void
): () => void {
  const registry = getRegistry(doc)
  const emit = () => {
    const agents: AgentRegistration[] = []
    registry.forEach((val) => {
      const reg = val as AgentRegistration
      if (reg.status === 'running') agents.push(reg)
    })
    onChange(agents)
  }
  registry.observe(emit)
  emit()
  return () => registry.unobserve(emit)
}
