import { createServer, IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import { applyUpdate, encodeStateAsUpdate, encodeStateVector } from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import fs from "fs";
import path from "path";
import { watch } from "chokidar";
import crypto from "crypto";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ─── Workspace store ─────────────────────────────────────────────────────────

interface Workspace {
  code: string;
  folder: string;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
  contentHashes: Map<string, string>;
  watcher: ReturnType<typeof watch> | null;
  writeTimers: Map<string, ReturnType<typeof setTimeout>>;
}

const workspaces = new Map<string, Workspace>();

function generateCode(): string {
  return crypto.randomBytes(3).toString("hex"); // 6-char hex
}

function md5(content: string): string {
  return crypto.createHash("md5").update(content).digest("hex");
}

const TEMPLATE_FILES: Record<string, string> = {
  "schema.ts": `import { pgTable, uuid, text, timestamp, boolean, integer } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatar: text("avatar").default("default.png"),
  role: text("role", { enum: ["admin", "member", "viewer"] }).default("member"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  ownerId: uuid("owner_id").references(() => users.id),
  isPublic: boolean("is_public").default(false),
  starCount: integer("star_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
})

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
})
`,
  "routes.ts": `import { Hono } from "hono"
import { cors } from "hono/cors"
import { jwt } from "hono/jwt"
import { db } from "./db"
import { users, projects, apiKeys } from "./schema"
import { eq, desc, and } from "drizzle-orm"

const app = new Hono()

app.use("/*", cors({ origin: "*" }))
app.use("/api/*", jwt({ secret: process.env.JWT_SECRET! }))

// Health check
app.get("/health", (c) => c.json({ status: "ok", uptime: process.uptime() }))

// List projects for authenticated user
app.get("/api/projects", async (c) => {
  const userId = c.get("jwtPayload").sub
  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, userId))
    .orderBy(desc(projects.createdAt))
  return c.json(result)
})

// Get project by slug
app.get("/api/projects/:slug", async (c) => {
  const slug = c.req.param("slug")
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1)
  if (!project.length) return c.json({ error: "Not found" }, 404)
  return c.json(project[0])
})

// Create project
app.post("/api/projects", async (c) => {
  const userId = c.get("jwtPayload").sub
  const body = await c.req.json()
  const result = await db.insert(projects).values({
    name: body.name,
    slug: body.name.toLowerCase().replace(/\\s+/g, "-"),
    description: body.description,
    ownerId: userId,
  }).returning()
  return c.json(result[0], 201)
})

export default app
`,
  "auth.ts": `import { sign, verify } from "hono/jwt"
import { db } from "./db"
import { users } from "./schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me"
const TOKEN_EXPIRY = 60 * 60 * 24 * 7 // 7 days

export async function authenticateUser(email: string, password: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!result.length) {
    throw new Error("Invalid credentials")
  }

  const user = result[0]
  // Password verification would go here
  // const valid = await bcrypt.compare(password, user.passwordHash)

  const token = await sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET
  )

  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } }
}

export async function validateToken(token: string) {
  try {
    const payload = await verify(token, JWT_SECRET)
    return payload
  } catch {
    return null
  }
}

export async function getUserById(id: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  return result[0] || null
}
`,
  "middleware.ts": `import type { Context, Next } from "hono"
import { getUserById } from "./auth"

export async function rateLimiter(c: Context, next: Next) {
  const ip = c.req.header("x-forwarded-for") || "unknown"
  // In production: check Redis for rate limit
  // const count = await redis.incr(\`rate:\${ip}\`)
  // if (count > 100) return c.json({ error: "Rate limited" }, 429)
  await next()
}

export async function logger(c: Context, next: Next) {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  console.log(\`\${c.req.method} \${c.req.url} \${c.res.status} \${ms}ms\`)
}

export async function requireAdmin(c: Context, next: Next) {
  const payload = c.get("jwtPayload")
  if (!payload) return c.json({ error: "Unauthorized" }, 401)

  const user = await getUserById(payload.sub)
  if (!user || user.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403)
  }

  c.set("user", user)
  await next()
}
`,
  "tests.ts": `import { describe, it, expect, beforeAll, afterAll } from "vitest"
import app from "./routes"

describe("API Routes", () => {
  let authToken: string

  beforeAll(async () => {
    // Setup test database
    // authToken = await getTestToken()
  })

  describe("GET /health", () => {
    it("returns ok status", async () => {
      const res = await app.request("/health")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe("ok")
      expect(body.uptime).toBeGreaterThan(0)
    })
  })

  describe("GET /api/projects", () => {
    it("requires authentication", async () => {
      const res = await app.request("/api/projects")
      expect(res.status).toBe(401)
    })

    it("returns user projects when authenticated", async () => {
      const res = await app.request("/api/projects", {
        headers: { Authorization: \`Bearer \${authToken}\` },
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
    })
  })

  describe("POST /api/projects", () => {
    it("creates a new project", async () => {
      const res = await app.request("/api/projects", {
        method: "POST",
        headers: {
          Authorization: \`Bearer \${authToken}\`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test Project",
          description: "A test project",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.name).toBe("Test Project")
      expect(body.slug).toBe("test-project")
    })
  })
})
`,
  "README.md": `# Acme SaaS Platform

A modern API platform built with Hono, Drizzle ORM, and PostgreSQL.

## Stack
- **Runtime**: Node.js + TypeScript
- **Framework**: Hono
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT tokens with role-based access
- **Testing**: Vitest

## Getting Started
\`\`\`bash
npm install
npm run db:migrate
npm run dev
\`\`\`

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | No | Health check |
| GET | /api/projects | Yes | List projects |
| GET | /api/projects/:slug | Yes | Get project |
| POST | /api/projects | Yes | Create project |
`,
};

function getWorkspaceFiles(folder: string, base = ""): string[] {
  const results: string[] = [];
  if (!fs.existsSync(folder)) return results;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...getWorkspaceFiles(path.join(folder, entry.name), rel));
    } else {
      results.push(rel);
    }
  }
  return results;
}

interface FileTreeNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileTreeNode[];
}

function buildFileTree(folder: string, base = ""): FileTreeNode[] {
  const nodes: FileTreeNode[] = [];
  if (!fs.existsSync(folder)) return nodes;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        type: "folder",
        path: rel,
        children: buildFileTree(path.join(folder, entry.name), rel),
      });
    } else {
      nodes.push({ name: entry.name, type: "file", path: rel });
    }
  }
  return nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "folder" ? -1 : 1;
  });
}

function createWorkspaceInstance(code: string): Workspace {
  const folder = path.resolve("workspaces", code);
  fs.mkdirSync(folder, { recursive: true });

  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  const contentHashes = new Map<string, string>();
  const writeTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const ws: Workspace = {
    code,
    folder,
    doc,
    awareness,
    clients: new Set(),
    contentHashes,
    watcher: null,
    writeTimers,
  };

  // Copy template files if folder is empty
  const existing = getWorkspaceFiles(folder);
  if (existing.length === 0) {
    for (const [name, content] of Object.entries(TEMPLATE_FILES)) {
      const fp = path.join(folder, name);
      fs.writeFileSync(fp, content, "utf-8");
    }
  }

  // Seed Y.Doc from disk
  const files = getWorkspaceFiles(folder);
  for (const rel of files) {
    const fp = path.join(folder, rel);
    try {
      const content = fs.readFileSync(fp, "utf-8");
      const yText = doc.getText(`file:${rel}`);
      if (yText.toString() === "") {
        doc.transact(() => yText.insert(0, content));
      }
      contentHashes.set(rel, md5(content));
    } catch {}
  }

  // ── Yjs → Disk: observe Y.Text changes and write back ──
  const setupYjsObserver = (rel: string) => {
    const yText = doc.getText(`file:${rel}`);
    yText.observe(() => {
      const content = yText.toString();
      const hash = md5(content);
      if (contentHashes.get(rel) === hash) return;
      contentHashes.set(rel, hash);

      // Debounce writes
      const existing = writeTimers.get(rel);
      if (existing) clearTimeout(existing);
      writeTimers.set(
        rel,
        setTimeout(() => {
          const fp = path.join(folder, rel);
          const dir = path.dirname(fp);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(fp, content, "utf-8");
          writeTimers.delete(rel);
        }, 300)
      );
    });
  };

  for (const rel of files) {
    setupYjsObserver(rel);
  }

  // ── Disk → Yjs: watch folder for changes ──
  const watcher = watch(folder, {
    ignoreInitial: true,
    ignored: /(^|[\/\\])\.|node_modules/,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });

  watcher.on("add", (filePath: string) => {
    const rel = path.relative(folder, filePath).replace(/\\/g, "/");
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const hash = md5(content);
      if (contentHashes.get(rel) === hash) return;
      contentHashes.set(rel, hash);
      const yText = doc.getText(`file:${rel}`);
      if (yText.toString() === "") {
        doc.transact(() => yText.insert(0, content));
      }
      setupYjsObserver(rel);
    } catch {}
  });

  watcher.on("change", (filePath: string) => {
    const rel = path.relative(folder, filePath).replace(/\\/g, "/");
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const hash = md5(content);
      if (contentHashes.get(rel) === hash) return;
      contentHashes.set(rel, hash);
      const yText = doc.getText(`file:${rel}`);
      const current = yText.toString();
      if (current === content) return;
      doc.transact(() => {
        yText.delete(0, yText.length);
        yText.insert(0, content);
      });
    } catch {}
  });

  watcher.on("unlink", (filePath: string) => {
    const rel = path.relative(folder, filePath).replace(/\\/g, "/");
    contentHashes.delete(rel);
  });

  ws.watcher = watcher;
  workspaces.set(code, ws);
  return ws;
}

// ─── Yjs sync helpers ────────────────────────────────────────────────────────

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

function sendToClient(ws: WebSocket, message: Uint8Array) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(message);
  }
}

function broadcastToWorkspace(workspace: Workspace, message: Uint8Array, exclude?: WebSocket) {
  for (const client of workspace.clients) {
    if (client !== exclude) sendToClient(client, message);
  }
}

function handleYjsConnection(ws: WebSocket, workspace: Workspace) {
  workspace.clients.add(ws);

  // Send sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  syncProtocol.writeSyncStep1(encoder, workspace.doc);
  sendToClient(ws, encoding.toUint8Array(encoder));

  // Send awareness states
  const awarenessStates = awarenessProtocol.encodeAwarenessUpdate(
    workspace.awareness,
    Array.from(workspace.awareness.getStates().keys())
  );
  const awarenessEncoder = encoding.createEncoder();
  encoding.writeVarUint(awarenessEncoder, MSG_AWARENESS);
  encoding.writeVarUint8Array(awarenessEncoder, awarenessStates);
  sendToClient(ws, encoding.toUint8Array(awarenessEncoder));

  ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
    try {
      const buf = data instanceof Buffer ? data : Buffer.from(data as ArrayBuffer);
      const decoder = decoding.createDecoder(new Uint8Array(buf));
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case MSG_SYNC: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MSG_SYNC);
          const syncMessageType = syncProtocol.readSyncMessage(
            decoder,
            encoder,
            workspace.doc,
            null
          );
          if (encoding.length(encoder) > 1) {
            sendToClient(ws, encoding.toUint8Array(encoder));
          }
          // If it was a sync step 2 or update, broadcast to others
          if (syncMessageType === 1 || syncMessageType === 2) {
            const updateEncoder = encoding.createEncoder();
            encoding.writeVarUint(updateEncoder, MSG_SYNC);
            syncProtocol.writeSyncStep2(updateEncoder, workspace.doc);
            // Actually we should broadcast the raw update
          }
          break;
        }
        case MSG_AWARENESS: {
          const update = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(workspace.awareness, update, ws);
          // Broadcast to other clients
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MSG_AWARENESS);
          encoding.writeVarUint8Array(encoder, update);
          broadcastToWorkspace(workspace, encoding.toUint8Array(encoder), ws);
          break;
        }
      }
    } catch (e) {
      console.error("Yjs message error:", e);
    }
  });

  // Listen for doc updates and broadcast
  const updateHandler = (update: Uint8Array, origin: unknown) => {
    if (origin === ws) return; // don't echo back
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    broadcastToWorkspace(workspace, encoding.toUint8Array(encoder));
  };
  workspace.doc.on("update", updateHandler);

  ws.on("close", () => {
    workspace.clients.delete(ws);
    workspace.doc.off("update", updateHandler);
    awarenessProtocol.removeAwarenessStates(
      workspace.awareness,
      [workspace.doc.clientID],
      null
    );
  });
}

// ─── Terminal helpers ────────────────────────────────────────────────────────

let ptyModule: typeof import("node-pty") | null = null;
try {
  ptyModule = require("node-pty");
} catch {
  console.warn("node-pty not available, terminal will use child_process fallback");
}

function handleTerminalConnection(ws: WebSocket, workspaceCode: string) {
  const workspace = workspaces.get(workspaceCode);
  if (!workspace) {
    ws.close(1008, "Workspace not found");
    return;
  }

  const shell = process.platform === "win32" ? "cmd.exe" : "bash";
  const shellArgs = process.platform === "win32" ? [] : ["-l"];

  if (ptyModule) {
    const pty = ptyModule.spawn(shell, shellArgs, {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd: workspace.folder,
      env: Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("CLAUDE"))) as Record<string, string>,
    });

    pty.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "output", data }));
      }
    });

    pty.onExit(({ exitCode }: { exitCode: number }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "exit", code: exitCode }));
        ws.close();
      }
    });

    ws.on("message", (raw: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "input") {
          pty.write(msg.data);
        } else if (msg.type === "resize" && msg.cols && msg.rows) {
          pty.resize(msg.cols, msg.rows);
        }
      } catch {}
    });

    ws.on("close", () => {
      pty.kill();
    });
  } else {
    // Fallback: child_process.spawn
    const { spawn } = require("child_process") as typeof import("child_process");
    const proc = spawn(shell, shellArgs, {
      cwd: workspace.folder,
      env: Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("CLAUDE"))) as NodeJS.ProcessEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdout?.on("data", (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "output", data: data.toString() }));
      }
    });
    proc.stderr?.on("data", (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "output", data: data.toString() }));
      }
    });
    proc.on("exit", (code: number | null) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "exit", code }));
        ws.close();
      }
    });

    ws.on("message", (raw: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "input") {
          proc.stdin?.write(msg.data);
        }
      } catch {}
    });

    ws.on("close", () => {
      proc.kill();
    });
  }
}

// ─── API handlers ────────────────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function handleApi(req: IncomingMessage, res: ServerResponse): boolean {
  const parsed = parse(req.url || "", true);
  const pathname = parsed.pathname || "";

  // POST /api/workspaces — create workspace
  if (pathname === "/api/workspaces" && req.method === "POST") {
    const code = generateCode();
    createWorkspaceInstance(code);
    sendJson(res, 200, { code });
    return true;
  }

  // GET /api/workspaces/join?code=X — validate + join
  if (pathname === "/api/workspaces/join" && req.method === "GET") {
    const code = parsed.query.code as string;
    if (!code) {
      sendJson(res, 400, { error: "Missing code" });
      return true;
    }
    // Create workspace if folder exists but not in memory
    const folder = path.resolve("workspaces", code);
    if (!workspaces.has(code) && fs.existsSync(folder)) {
      createWorkspaceInstance(code);
    }
    if (!workspaces.has(code)) {
      sendJson(res, 404, { error: "Workspace not found" });
      return true;
    }
    sendJson(res, 200, { code });
    return true;
  }

  // GET /api/workspaces/files?code=X — file tree
  if (pathname === "/api/workspaces/files" && req.method === "GET") {
    const code = parsed.query.code as string;
    const workspace = workspaces.get(code);
    if (!workspace) {
      sendJson(res, 404, { error: "Workspace not found" });
      return true;
    }
    const tree = buildFileTree(workspace.folder);
    const flat = getWorkspaceFiles(workspace.folder);
    sendJson(res, 200, { tree, files: flat });
    return true;
  }

  // GET /api/workspaces/files/read?code=X&path=Y — read file and seed into Yjs
  if (pathname === "/api/workspaces/files/read" && req.method === "GET") {
    const code = parsed.query.code as string;
    const filePath = parsed.query.path as string;
    const workspace = workspaces.get(code);
    if (!workspace) { sendJson(res, 404, { error: "Workspace not found" }); return true; }
    if (!filePath) { sendJson(res, 400, { error: "Missing path" }); return true; }

    const resolved = path.resolve(workspace.folder, filePath);
    if (!resolved.startsWith(path.resolve(workspace.folder))) {
      sendJson(res, 400, { error: "Invalid path" }); return true;
    }
    if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      sendJson(res, 404, { error: "File not found" }); return true;
    }

    try {
      const content = fs.readFileSync(resolved, "utf-8");
      // Seed into Yjs if not already there
      const yText = workspace.doc.getText(`file:${filePath}`);
      if (yText.toString() === "" && content.length > 0) {
        workspace.doc.transact(() => yText.insert(0, content));
        workspace.contentHashes.set(filePath, md5(content));
      }
      sendJson(res, 200, { content });
    } catch {
      sendJson(res, 500, { error: "Failed to read file" });
    }
    return true;
  }

  // POST /api/workspaces/files/create — create file or folder
  if (pathname === "/api/workspaces/files/create" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        const { code, filePath, type } = JSON.parse(body) as { code: string; filePath: string; type: "file" | "folder" };
        const workspace = workspaces.get(code);
        if (!workspace) { sendJson(res, 404, { error: "Workspace not found" }); return; }
        // Prevent path traversal
        const resolved = path.resolve(workspace.folder, filePath);
        if (!resolved.startsWith(path.resolve(workspace.folder))) {
          sendJson(res, 400, { error: "Invalid path" }); return;
        }
        if (fs.existsSync(resolved)) { sendJson(res, 409, { error: "Already exists" }); return; }
        if (type === "folder") {
          fs.mkdirSync(resolved, { recursive: true });
        } else {
          const dir = path.dirname(resolved);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(resolved, "", "utf-8");
          // Seed into Yjs doc
          const yText = workspace.doc.getText(`file:${filePath}`);
          if (yText.toString() === "") {
            workspace.doc.transact(() => yText.insert(0, ""));
          }
        }
        sendJson(res, 200, { ok: true });
      } catch {
        sendJson(res, 400, { error: "Invalid request" });
      }
    });
    return true;
  }

  // POST /api/workspaces/files/delete — delete file
  if (pathname === "/api/workspaces/files/delete" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        const { code, filePath } = JSON.parse(body) as { code: string; filePath: string };
        const workspace = workspaces.get(code);
        if (!workspace) { sendJson(res, 404, { error: "Workspace not found" }); return; }
        const resolved = path.resolve(workspace.folder, filePath);
        if (!resolved.startsWith(path.resolve(workspace.folder))) {
          sendJson(res, 400, { error: "Invalid path" }); return;
        }
        if (!fs.existsSync(resolved)) { sendJson(res, 404, { error: "File not found" }); return; }
        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
          fs.rmSync(resolved, { recursive: true });
        } else {
          fs.unlinkSync(resolved);
        }
        sendJson(res, 200, { ok: true });
      } catch {
        sendJson(res, 400, { error: "Invalid request" });
      }
    });
    return true;
  }

  // POST /api/agent/run — call K2 Think V2 to generate code
  if (pathname === "/api/agent/run" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", async () => {
      try {
        const { code, filePath, prompt, allFiles } = JSON.parse(body) as {
          code: string; filePath: string; prompt: string; allFiles?: Record<string, string>;
        };
        const workspace = workspaces.get(code);
        if (!workspace) { sendJson(res, 404, { error: "Workspace not found" }); return; }

        // Read current file content
        const yText = workspace.doc.getText(`file:${filePath}`);
        const currentContent = yText.toString();

        // Build context from all files
        let filesContext = "";
        if (allFiles) {
          for (const [fp, content] of Object.entries(allFiles)) {
            if (fp !== filePath && content.trim()) {
              filesContext += `\n--- ${fp} ---\n${content}\n`;
            }
          }
        }

        const systemPrompt = `You are an expert coding assistant working in a collaborative workspace called Parachute.
You are editing the file "${filePath}".
${filesContext ? `\nHere are the other files in the workspace for context:\n${filesContext}` : ""}

IMPORTANT RULES:
- Return ONLY the code to ADD to the file. Do NOT return the existing content.
- Do NOT wrap in markdown code fences or backticks.
- Write clean, working code.
- Be concise — add only what's needed.`;

        const messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Current content of ${filePath}:\n\`\`\`\n${currentContent}\n\`\`\`\n\nRequest: ${prompt}` },
        ];

        const apiKey = process.env.K2_API_KEY || "";

        // Stream response via SSE
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        });

        const apiRes = await fetch("https://api.k2think.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "MBZUAI-IFM/K2-Think-v2",
            messages,
            stream: true,
            max_tokens: 2048,
          }),
        });

        if (!apiRes.ok || !apiRes.body) {
          res.write(`data: ${JSON.stringify({ type: "error", content: `K2 API error: ${apiRes.status}` })}\n\n`);
          res.end();
          return;
        }

        const reader = apiRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        let thinkingDone = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (!delta) continue;

              // Handle reasoning/thinking tokens
              if (delta.reasoning_content) {
                res.write(`data: ${JSON.stringify({ type: "thinking", content: delta.reasoning_content })}\n\n`);
                continue;
              }

              if (delta.content) {
                // K2 may include <think>...</think> in content — strip it
                let text = delta.content;
                if (!thinkingDone) {
                  if (text.includes("</think>")) {
                    text = text.split("</think>").pop() || "";
                    thinkingDone = true;
                  } else if (fullContent.length === 0 || !thinkingDone) {
                    // Could be inside think block, check accumulated
                    fullContent += text;
                    if (fullContent.includes("</think>")) {
                      fullContent = fullContent.split("</think>").pop() || "";
                      thinkingDone = true;
                      text = "";
                    } else {
                      continue; // skip until thinking is done
                    }
                  }
                }
                if (text) {
                  fullContent = thinkingDone ? fullContent + text : text;
                  res.write(`data: ${JSON.stringify({ type: "content", content: text })}\n\n`);
                }
              }
            } catch {}
          }
        }

        // Clean code fences from final content
        let cleaned = fullContent.replace(/```[\w]*\n?/g, "").replace(/```\s*$/g, "").trim();
        res.write(`data: ${JSON.stringify({ type: "done", fullContent: cleaned })}\n\n`);
        res.end();
      } catch (err: any) {
        res.write(`data: ${JSON.stringify({ type: "error", content: err.message || "Unknown error" })}\n\n`);
        res.end();
      }
    });
    return true;
  }

  return false;
}

// ─── Boot ────────────────────────────────────────────────────────────────────

app.prepare().then(() => {
  const server = createServer((req, res) => {
    // Try API routes first
    if (handleApi(req, res)) return;
    // Otherwise Next.js handles it
    const parsedUrl = parse(req.url || "", true);
    handle(req, res, parsedUrl);
  });

  // WebSocket server (no path — we route manually)
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const parsed = parse(req.url || "", true);
    const pathname = parsed.pathname || "";

    // Yjs sync: /ws/yjs/{code}
    const yjsMatch = pathname.match(/^\/ws\/yjs\/(.+)$/);
    if (yjsMatch) {
      const code = yjsMatch[1];
      // Create workspace if needed
      if (!workspaces.has(code)) {
        const folder = path.resolve("workspaces", code);
        if (fs.existsSync(folder)) {
          createWorkspaceInstance(code);
        }
      }
      const workspace = workspaces.get(code);
      if (!workspace) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        handleYjsConnection(ws, workspace);
      });
      return;
    }

    // Terminal: /ws/terminal/?workspace={code}
    if (pathname === "/ws/terminal" || pathname === "/ws/terminal/") {
      const code = parsed.query.workspace as string;
      if (!code) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        handleTerminalConnection(ws, code);
      });
      return;
    }

    // Let Next.js handle HMR websockets
    // Don't destroy the socket for unrecognized paths
  });

  server.listen(port, hostname, () => {
    console.log(`> Parachute server ready on http://${hostname}:${port}`);
    const ips = getLanIPs();
    if (ips.length > 0) {
      console.log(`> LAN access (share one of these with teammates):`);
      for (const { name, address } of ips) {
        console.log(`    http://${address}:${port}  (${name})`);
      }
    }
  });
});

function getLanIPs(): { name: string; address: string }[] {
  const os = require("os");
  const interfaces = os.networkInterfaces();
  const results: { name: string; address: string }[] = [];
  // Skip known virtual adapter prefixes
  const skipPatterns = [
    /virtualbox/i, /vmware/i, /vbox/i, /docker/i,
    /vethernet/i, /hyper-v/i,
  ];
  for (const name of Object.keys(interfaces)) {
    if (skipPatterns.some(p => p.test(name))) continue;
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        results.push({ name, address: iface.address });
      }
    }
  }
  // If all got filtered, return all non-internal IPv4 as fallback
  if (results.length === 0) {
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          results.push({ name, address: iface.address });
        }
      }
    }
  }
  return results;
}
