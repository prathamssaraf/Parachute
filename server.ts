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
  "index.ts": `import { createServer } from 'http'\n\nconst PORT = 3000\n\nconst server = createServer((req, res) => {\n  res.end('Hello World')\n})\n\nserver.listen(PORT)\n`,
  "utils.ts": `export function formatDate(date: Date): string {\n  return date.toISOString().split('T')[0]\n}\n`,
  "types.ts": `export interface User {\n  id: string\n  name: string\n  email: string\n}\n`,
  "README.md": `# Workspace\n\nA collaborative workspace powered by Parachute.\n`,
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
