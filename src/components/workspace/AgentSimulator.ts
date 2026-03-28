import * as Y from 'yjs'

export interface ActivityEvent {
  id: string
  time: string
  type: 'info' | 'warning' | 'success' | 'conflict'
  agent: string
  agentColor: string
  msg: string
}

export type AgentFlow = 'primary' | 'detour' | 'integrator'
export type AgentStatus = 'idle' | 'thinking' | 'writing' | 'waiting'

export interface AgentSimulatorOptions {
  doc: Y.Doc
  activeFile: string
  agentName: string
  agentColor: string
  flow: AgentFlow
  lockedBy?: string
  onEvent: (event: ActivityEvent) => void
  /** Called whenever the agent switches which file it is editing or changes status */
  onStatusUpdate: (agentFile: string | null, status: AgentStatus) => void
}

// ─── Code snippets ───────────────────────────────────────────────────────────

// Alice (primary): adds logger middleware to index.ts
const PRIMARY_INDEX = `
// Logger middleware
function createLogger(prefix: string) {
  return (req: any, res: any, next: () => void) => {
    const start = Date.now()
    console.log(\`[\${prefix}] \${req.method} \${req.url}\`)
    res.on('finish', () => {
      console.log(\`[\${prefix}] \${res.statusCode} +\${Date.now() - start}ms\`)
    })
    next()
  }
}
`

// Bob (detour step 1): adds helpers to utils.ts
const DETOUR_UTILS = `
// Duration formatter
export function formatDuration(ms: number): string {
  if (ms < 1000) return \`\${ms}ms\`
  if (ms < 60000) return \`\${(ms / 1000).toFixed(1)}s\`
  return \`\${Math.floor(ms / 60000)}m \${Math.floor((ms % 60000) / 1000)}s\`
}

// Bytes formatter
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return \`\${bytes}B\`
  if (bytes < 1048576) return \`\${(bytes / 1024).toFixed(1)}KB\`
  return \`\${(bytes / 1048576).toFixed(1)}MB\`
}
`

// Bob (detour step 2): adds route handler to index.ts, building on Alice's logger
const DETOUR_INDEX = `
// Route handler — uses logger from above
const logger = createLogger('HTTP')

const serverWithLogging = createServer((req, res) => {
  logger(req, res, () => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, path: req.url, ts: Date.now() }))
  })
})

serverWithLogging.listen(PORT + 1)
`

// Charlie (integrator): adds TypeScript types for the new utilities
const INTEGRATOR_TYPES = `
// Types for logger (added by Claude — Alice's createLogger)
export type LoggerMiddleware = (req: any, res: any, next: () => void) => void

// Types for format helpers (added by Claude — Bob's formatDuration / formatBytes)
export type FormatFn = (value: number) => string

export interface ServerConfig {
  port: number
  logger: LoggerMiddleware
  format: {
    duration: FormatFn
    bytes: FormatFn
  }
}
`

// Charlie: updates README with the new API surface
const INTEGRATOR_README = `
## Utilities

- \`formatDuration(ms)\` — human-readable duration (e.g. \`1.2s\`)
- \`formatBytes(bytes)\` — human-readable size (e.g. \`3.4KB\`)
- \`createLogger(prefix)\` — Express-style request logger middleware

## Servers

| Port | Description |
|------|-------------|
| 3000 | Original Hello World |
| 3001 | JSON API with logging |
`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function uid(): string { return Math.random().toString(36).slice(2, 9) }
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function waitForFileFree(doc: Y.Doc, file: string, onTick: (s: number) => void): Promise<void> {
  return new Promise(resolve => {
    const meta = doc.getMap('agent-meta')
    const isFree = () => {
      const lf = meta.get('lockFile') as string | undefined
      return !lf || lf !== file
    }
    if (isFree()) { resolve(); return }
    let elapsed = 0
    const ticker = setInterval(() => { elapsed += 2; onTick(elapsed) }, 2000)
    const obs = () => {
      if (isFree()) { clearInterval(ticker); meta.unobserve(obs); resolve() }
    }
    meta.observe(obs)
  })
}

async function typeInto(doc: Y.Doc, file: string, code: string, charDelay = 28): Promise<void> {
  const yText = doc.getText(`file:${file}`)
  const start = yText.length
  for (let i = 0; i < code.length; i++) {
    yText.insert(start + i, code[i])
    await delay(charDelay)
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function runAgentSimulation(opts: AgentSimulatorOptions): Promise<void> {
  const { doc, activeFile, agentName, agentColor, flow, lockedBy, onEvent, onStatusUpdate } = opts
  const meta = doc.getMap('agent-meta')

  const emit = (type: ActivityEvent['type'], msg: string) =>
    onEvent({ id: uid(), time: getTime(), type, agent: agentName, agentColor, msg })

  const orch = (type: ActivityEvent['type'], msg: string) =>
    onEvent({ id: uid(), time: getTime(), type, agent: 'Orchestrator', agentColor: 'emerald', msg })

  // Note: onEvent may be a broadcasting wrapper that pushes to Y.Array,
  // so all clients see these events in real-time.

  const lock = (file: string) => {
    meta.set('lockFile', file)
    meta.set('lockOwner', agentName)
  }
  const unlock = () => {
    meta.set('lockFile', '')
    meta.set('lockOwner', '')
  }

  // ── PRIMARY FLOW (Alice: first agent) ──────────────────────────────────────
  if (flow === 'primary') {
    onStatusUpdate(activeFile, 'thinking')
    emit('info', `Analyzing codebase...`)
    await delay(1400)

    emit('info', `Reading ${activeFile}...`)
    await delay(1200)

    orch('info', `Agent locked ${activeFile}`)
    lock(activeFile)
    onStatusUpdate(activeFile, 'writing')

    await typeInto(doc, activeFile, PRIMARY_INDEX)

    unlock()
    await delay(300)
    emit('success', `Done — added logger middleware to ${activeFile} ✓`)
    onStatusUpdate(null, 'idle')
  }

  // ── DETOUR FLOW (Bob: index.ts locked → utils.ts first → back to index.ts) ─
  else if (flow === 'detour') {
    onStatusUpdate(activeFile, 'thinking')
    emit('info', `Analyzing codebase...`)
    await delay(1400)

    emit('info', `Reading ${activeFile}...`)
    await delay(1000)

    // Detect lock
    orch('conflict', `⚠ ${activeFile} is locked by ${lockedBy || 'another agent'} — rerouting`)
    await delay(600)
    orch('warning', `Redirecting ${agentName} → utils.ts while ${activeFile} is in use`)
    await delay(300)

    // ── Step 1: work on utils.ts ──
    onStatusUpdate('utils.ts', 'writing')
    emit('info', `Switching to utils.ts — working on format helpers`)
    lock('utils.ts')
    await delay(400)

    await typeInto(doc, 'utils.ts', DETOUR_UTILS)

    unlock()
    emit('success', `Finished utils.ts — formatDuration + formatBytes added ✓`)
    await delay(500)

    // ── Step 2: return to index.ts ──
    onStatusUpdate(activeFile, 'thinking')
    emit('info', `Returning to ${activeFile}...`)
    await delay(800)

    // Check if still locked
    const stillLocked = (meta.get('lockFile') as string) === activeFile
    if (stillLocked) {
      orch('warning', `${activeFile} still locked — holding ${agentName}`)
      onStatusUpdate(activeFile, 'waiting')

      await waitForFileFree(doc, activeFile, (s) => {
        orch('info', `Still waiting... ${lockedBy || 'other agent'} editing for ${s}s`)
      })

      orch('success', `${activeFile} is now free — resuming ${agentName}`)
      await delay(400)
    }

    // Re-read and extend
    const lineCount = doc.getText(`file:${activeFile}`).toString().split('\n').length
    emit('info', `Re-reading ${activeFile} — found ${lineCount} lines with new changes`)
    await delay(900)

    emit('info', `Building route handler on top of Alice's logger...`)
    onStatusUpdate(activeFile, 'writing')
    lock(activeFile)

    await typeInto(doc, activeFile, DETOUR_INDEX)

    unlock()
    await delay(300)
    emit('success', `Done — added JSON route handler to ${activeFile} ✓`)
    onStatusUpdate(null, 'idle')
  }

  // ── INTEGRATOR FLOW (Charlie: types + README, reads what others changed) ────
  else if (flow === 'integrator') {
    onStatusUpdate('types.ts', 'thinking')
    emit('info', `Analyzing codebase...`)
    await delay(1400)

    emit('info', `Scanning all modified files...`)
    await delay(1000)

    // Read what others did
    const utilsContent = doc.getText('file:utils.ts').toString()
    const indexContent = doc.getText('file:index.ts').toString()
    const hasUtils = utilsContent.includes('formatDuration')
    const hasLogger = indexContent.includes('createLogger')

    if (hasUtils) emit('info', `Detected formatDuration + formatBytes in utils.ts`)
    await delay(700)
    if (hasLogger) emit('info', `Detected createLogger middleware in index.ts`)
    await delay(700)

    orch('info', `No conflicts detected — ${agentName} integrating changes across types + docs`)
    await delay(400)

    // ── Step 1: update types.ts ──
    onStatusUpdate('types.ts', 'writing')
    emit('info', `Generating TypeScript types for new utilities...`)
    lock('types.ts')

    await typeInto(doc, 'types.ts', INTEGRATOR_TYPES)

    unlock()
    emit('success', `Added ServerConfig + LoggerMiddleware + FormatFn types ✓`)
    await delay(600)

    // ── Step 2: update README.md ──
    onStatusUpdate('README.md', 'writing')
    emit('info', `Updating README.md with new API surface...`)
    lock('README.md')

    await typeInto(doc, 'README.md', INTEGRATOR_README)

    unlock()
    await delay(300)
    emit('success', `Done — updated types.ts + README.md ✓`)
    onStatusUpdate(null, 'idle')
  }

  // Mark run as completed (used for flow detection)
  meta.set('completedRuns', ((meta.get('completedRuns') as number) || 0) + 1)
}
