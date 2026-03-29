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

// Agent 1 (primary): extends the schema with team membership + invites
const PRIMARY_SCHEMA = `
export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "editor", "viewer"] }).default("editor"),
  invitedBy: uuid("invited_by").references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
})

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role", { enum: ["editor", "viewer"] }).default("editor"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
})
`

// Agent 2 (detour step 1): adds team routes to middleware.ts since routes.ts is locked
const DETOUR_MIDDLEWARE = `

export async function requireProjectAccess(c: Context, next: Next) {
  const payload = c.get("jwtPayload")
  const projectId = c.req.param("projectId")
  if (!payload || !projectId) return c.json({ error: "Unauthorized" }, 401)

  const membership = await db
    .select()
    .from(teamMembers)
    .where(and(
      eq(teamMembers.projectId, projectId),
      eq(teamMembers.userId, payload.sub)
    ))
    .limit(1)

  if (!membership.length) return c.json({ error: "Not a team member" }, 403)
  c.set("membership", membership[0])
  await next()
}
`

// Agent 2 (detour step 2): adds invite + team endpoints to routes.ts after it's free
const DETOUR_ROUTES = `

// Team management routes
app.get("/api/projects/:projectId/team", requireProjectAccess, async (c) => {
  const projectId = c.req.param("projectId")
  const members = await db
    .select({ id: users.id, name: users.name, email: users.email, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.projectId, projectId))
  return c.json(members)
})

app.post("/api/projects/:projectId/invite", requireProjectAccess, async (c) => {
  const projectId = c.req.param("projectId")
  const { email, role } = await c.req.json()
  const token = crypto.randomUUID()
  const invite = await db.insert(invites).values({
    projectId, email, role,
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }).returning()
  // In production: send invite email here
  return c.json(invite[0], 201)
})
`

// Agent 3 (integrator): adds comprehensive tests for the new team endpoints
const INTEGRATOR_TESTS = `

describe("Team Management", () => {
  describe("GET /api/projects/:id/team", () => {
    it("returns team members for a project", async () => {
      const res = await app.request("/api/projects/test-id/team", {
        headers: { Authorization: \`Bearer \${authToken}\` },
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
      body.forEach((member: any) => {
        expect(member).toHaveProperty("name")
        expect(member).toHaveProperty("email")
        expect(member).toHaveProperty("role")
      })
    })

    it("rejects non-members", async () => {
      const res = await app.request("/api/projects/other-id/team", {
        headers: { Authorization: \`Bearer \${outsiderToken}\` },
      })
      expect(res.status).toBe(403)
    })
  })

  describe("POST /api/projects/:id/invite", () => {
    it("creates an invite with expiry", async () => {
      const res = await app.request("/api/projects/test-id/invite", {
        method: "POST",
        headers: {
          Authorization: \`Bearer \${authToken}\`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "new@example.com", role: "editor" }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.token).toBeDefined()
      expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now())
    })
  })
})
`

// Agent 3: updates README with team management docs
const INTEGRATOR_README = `

## Team Management

### Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/projects/:id/team | Yes | List team members |
| POST | /api/projects/:id/invite | Yes | Send invite |

### Roles
- **owner** — full access, can delete project
- **editor** — read/write access to all resources
- **viewer** — read-only access
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

  // ── PRIMARY FLOW: extends schema.ts with team tables ────────────────────────
  if (flow === 'primary') {
    onStatusUpdate(activeFile, 'thinking')
    emit('info', `Analyzing schema and relationships...`)
    await delay(1400)

    emit('info', `Reading ${activeFile} — found users, projects, apiKeys tables`)
    await delay(1200)

    orch('info', `Agent locked ${activeFile}`)
    lock(activeFile)
    onStatusUpdate(activeFile, 'writing')

    await typeInto(doc, activeFile, PRIMARY_SCHEMA)

    unlock()
    await delay(300)
    emit('success', `Done — added teamMembers + invites tables to ${activeFile} ✓`)
    onStatusUpdate(null, 'idle')
  }

  // ── DETOUR FLOW: routes.ts locked → middleware.ts first → back to routes.ts ─
  else if (flow === 'detour') {
    onStatusUpdate(activeFile, 'thinking')
    emit('info', `Analyzing codebase structure...`)
    await delay(1400)

    emit('info', `Reading ${activeFile}...`)
    await delay(1000)

    // Detect lock
    orch('conflict', `⚠ ${activeFile} is locked by ${lockedBy || 'another agent'} — rerouting`)
    await delay(600)
    orch('warning', `Redirecting ${agentName} → middleware.ts while ${activeFile} is in use`)
    await delay(300)

    // ── Step 1: work on middleware.ts ──
    onStatusUpdate('middleware.ts', 'writing')
    emit('info', `Switching to middleware.ts — adding project access guard`)
    lock('middleware.ts')
    await delay(400)

    await typeInto(doc, 'middleware.ts', DETOUR_MIDDLEWARE)

    unlock()
    emit('success', `Finished middleware.ts — requireProjectAccess added ✓`)
    await delay(500)

    // ── Step 2: return to routes.ts ──
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
    emit('info', `Re-reading ${activeFile} — found ${lineCount} lines, importing new middleware`)
    await delay(900)

    emit('info', `Adding team management + invite endpoints...`)
    onStatusUpdate(activeFile, 'writing')
    lock(activeFile)

    await typeInto(doc, activeFile, DETOUR_ROUTES)

    unlock()
    await delay(300)
    emit('success', `Done — added /team and /invite routes to ${activeFile} ✓`)
    onStatusUpdate(null, 'idle')
  }

  // ── INTEGRATOR FLOW: writes tests + updates docs ──────────────────────────
  else if (flow === 'integrator') {
    onStatusUpdate('tests.ts', 'thinking')
    emit('info', `Scanning workspace for recent changes...`)
    await delay(1400)

    emit('info', `Analyzing all modified files...`)
    await delay(1000)

    // Read what others did
    const schemaContent = doc.getText('file:schema.ts').toString()
    const routesContent = doc.getText('file:routes.ts').toString()
    const hasTeamMembers = schemaContent.includes('teamMembers')
    const hasInviteRoute = routesContent.includes('/invite')

    if (hasTeamMembers) emit('info', `Detected teamMembers + invites tables in schema.ts`)
    await delay(700)
    if (hasInviteRoute) emit('info', `Detected /team and /invite endpoints in routes.ts`)
    await delay(700)

    orch('info', `No conflicts detected — ${agentName} writing tests + updating docs`)
    await delay(400)

    // ── Step 1: add tests ──
    onStatusUpdate('tests.ts', 'writing')
    emit('info', `Generating test cases for team management...`)
    lock('tests.ts')

    await typeInto(doc, 'tests.ts', INTEGRATOR_TESTS)

    unlock()
    emit('success', `Added team member + invite test suites ✓`)
    await delay(600)

    // ── Step 2: update README.md ──
    onStatusUpdate('README.md', 'writing')
    emit('info', `Updating README.md with team management docs...`)
    lock('README.md')

    await typeInto(doc, 'README.md', INTEGRATOR_README)

    unlock()
    await delay(300)
    emit('success', `Done — updated tests.ts + README.md ✓`)
    onStatusUpdate(null, 'idle')
  }

  // Mark run as completed (used for flow detection)
  meta.set('completedRuns', ((meta.get('completedRuns') as number) || 0) + 1)
}
