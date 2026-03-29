<div align="center">

# Parachute

### The collaborative workspace where AI agents code together — without stepping on each other.

A real-time, multi-user cloud IDE where every developer brings their own AI coding agent, and a master Orchestrator AI keeps them all in sync.

**Built at [YHack 2026](https://yhack.org)**

[Getting Started](#getting-started) | [How It Works](#how-it-works) | [Architecture](#architecture) | [Tech Stack](#tech-stack)

</div>

---

## What is Parachute?

Parachute is a browser-based collaborative workspace designed for teams that use AI coding agents. One developer creates a workspace, shares an invite code, and everyone joins through their browser into a shared VS Code-like environment. Each participant can launch their own AI agent to write code — and a central **Orchestrator AI** watches all of them in real time, preventing conflicts, eliminating duplicate work, and managing file locks so nothing breaks.

Think Google Docs, but for code, with AI agents as first-class participants.

## Key Features

- **Shared Cloud Workspace** — Create a workspace with one click. Share the invite code. Everyone gets the same files, the same terminal, and a live view of what every other developer (and their agent) is doing.

- **Monaco Editor** — A full VS Code-style editor in the browser with syntax highlighting, IntelliSense, and multi-cursor support.

- **Real-Time Collaboration (Yjs CRDTs)** — All edits are synchronized across every connected client using conflict-free replicated data types. Live cursors and presence indicators show who is editing what.

- **Orchestrator AI** — A master intelligence layer that monitors every active agent across every user. It detects overlapping work, manages file-level locks, builds a live dependency graph, and reroutes agents to prevent merge conflicts before they happen.

- **No Duplicate Work** — When two agents start working on the same file, the Orchestrator detects the collision and automatically reassigns the latecomer to the next priority task. No wasted tokens, no wasted time.

- **Conflict Prevention** — The Orchestrator predicts merge conflicts before they occur. It uses file locking and agent flow classification (primary, detour, integrator) to keep every agent productive on a non-overlapping surface.

- **Agent-Agnostic** — Each developer can bring their own AI agent. The Orchestrator coordinates them all regardless of provider.

- **Integrated Terminal** — A full terminal (xterm.js + node-pty) running in the browser, scoped to the workspace directory.

- **File Explorer** — A tree-based file browser with support for creating and deleting files and folders, just like a local IDE.

- **Live Activity Feed** — Every agent action, orchestrator decision, lock acquisition, and conflict resolution is logged in a real-time event stream visible to all participants.

## How It Works

### Creating and Joining a Workspace

1. A developer clicks **Create Workspace** on the landing page. The server generates a unique 6-character invite code and provisions a workspace directory on disk with starter template files.
2. The developer shares the invite code with teammates.
3. Each teammate enters the code to join. Their browser connects via WebSocket, and the Yjs document state is synchronized immediately — they see all existing files and any in-progress edits.

### Real-Time Collaboration

All file content lives in a shared [Yjs](https://yjs.dev) document. Every keystroke is broadcast as a CRDT operation over WebSocket. The server acts as the authoritative sync hub:

- **Browser to Server** — Edits flow as Yjs sync messages over a persistent WebSocket connection at `/ws/yjs/{workspaceCode}`.
- **Server to Disk** — The server observes Yjs document changes and debounces writes back to the filesystem (300ms stabilization).
- **Disk to Server** — A [chokidar](https://github.com/paulmillr/chokidar) file watcher picks up external filesystem changes (e.g., from the integrated terminal running `git pull`) and injects them back into the Yjs document.
- **Awareness Protocol** — Each client publishes its cursor position, selection, username, and color via the Yjs awareness protocol, enabling live cursor rendering in every editor.

### The Orchestrator

The Orchestrator is the brain of Parachute. It runs as a shared Yjs data structure (`Y.Map('orchestrator')`) that every client can read and write to, giving all participants a consistent, real-time view of the coordination state.

**Agent Registration** — When a user launches an AI agent, it registers with the Orchestrator: its run ID, target file, assigned file, username, color, and a flow classification.

**Flow Classification** — Each agent is assigned one of three flows:

| Flow | Role | Example |
|------|------|---------|
| `primary` | First agent on a file. Gets the lock and works uninterrupted. | Alice's agent adds logger middleware to `index.ts`. |
| `detour` | Wanted a locked file. Redirected to a free file first, then returns when the lock is released. | Bob's agent is rerouted to `utils.ts`, then comes back to `index.ts` after Alice finishes. |
| `integrator` | Third+ agent. Reads what others have written and produces cross-cutting work (types, docs, glue code). | Charlie's agent generates TypeScript types and updates the README based on Alice's and Bob's changes. |

**Conflict Detection** — The Orchestrator groups all active agents by their assigned file. If two agents claim the same file, it identifies the owner (earliest `startedAt` timestamp) and computes a redirect target for the latecomer.

**File Locking** — A lightweight lock is stored in `Y.Map('agent-meta')`. Before writing, an agent acquires the lock; after finishing, it releases it. Other agents that need the same file enter a `waiting` state and resume automatically when the lock clears.

**Event Broadcasting** — Every orchestrator decision (lock acquired, conflict detected, agent redirected, work completed) is pushed to `Y.Array('orchestrator-events')`, which all clients observe. This powers the live activity feed in the UI.

## Architecture

```
Browser (Client)                          Server (Node.js)
+--------------------------+              +-----------------------------+
| Next.js React App        |              | Custom HTTP + WS Server     |
|                          |  WebSocket   |                             |
| Monaco Editor  <---------|--  /ws/yjs   |-->  Yjs Doc (per workspace) |
| Yjs Provider   <---------|------------->|-->  Awareness               |
| xterm.js       <---------|--  /ws/term  |-->  node-pty (shell)        |
|                          |              |                             |
| Orchestrator UI          |   REST API   | /api/workspaces (CRUD)      |
| File Explorer  <---------|-- /api/files |-->  Filesystem (chokidar)   |
| Activity Feed            |              |                             |
+--------------------------+              +-----------------------------+
                                                     |
                                                     v
                                            /workspaces/{code}/
                                              index.ts
                                              utils.ts
                                              types.ts
                                              ...
```

Each workspace is a self-contained directory on the server. The Yjs document is the source of truth for in-memory state; the filesystem is the source of truth for persistence. A bidirectional sync layer (Yjs observers + chokidar watchers) keeps them consistent, with MD5 hashing to break feedback loops.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Language | [TypeScript 5](https://www.typescriptlang.org) |
| UI | [React 19](https://react.dev), [Tailwind CSS 4](https://tailwindcss.com), [Framer Motion](https://www.framer.com/motion/) |
| Editor | [Monaco Editor](https://microsoft.github.io/monaco-editor/) (@monaco-editor/react) |
| Real-time Sync | [Yjs](https://yjs.dev) CRDTs + [y-websocket](https://github.com/yjs/y-websocket) + [y-protocols](https://github.com/yjs/y-protocols) |
| Terminal | [xterm.js](https://xtermjs.org) + [node-pty](https://github.com/microsoft/node-pty) |
| Server | Custom Node.js HTTP server with [ws](https://github.com/websockets/ws) WebSocket |
| File Watching | [chokidar](https://github.com/paulmillr/chokidar) |
| Icons | [Lucide React](https://lucide.dev) |

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9 (or yarn/pnpm)
- A C++ toolchain for `node-pty` native compilation (on Windows: `npm install --global windows-build-tools`, on macOS: Xcode Command Line Tools, on Linux: `build-essential`)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/parachute.git
cd parachute

# Install dependencies
npm install

# Start the development server
npm run dev
```

The server starts on `http://localhost:3000` by default. LAN IP addresses are printed to the console so teammates on the same network can connect directly.

### Usage

1. Open `http://localhost:3000` in your browser.
2. Click **Create Workspace** to provision a new workspace. You will receive a 6-character invite code.
3. Share the invite code with your teammates.
4. Teammates click **Join Workspace** and enter the code.
5. Everyone now sees the same file tree, can edit files collaboratively in real time, and can launch AI agents from within the workspace.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP/WebSocket server port |
| `NODE_ENV` | `development` | Set to `production` for optimized builds |

### Production Build

```bash
npm run build
npm start
```

## Screenshots

> *Screenshots coming soon.*

<!--
![Landing Page](./screenshots/landing.png)
![Workspace Editor](./screenshots/workspace.png)
![Orchestrator Activity Feed](./screenshots/orchestrator.png)
-->

## Project Structure

```
parachute/
  server.ts              # Custom HTTP + WebSocket server (Yjs sync, terminal, REST API)
  src/
    app/
      page.tsx           # Landing page
      workspace/         # Workspace IDE view
    components/
      workspace/
        AgentSimulator.ts  # AI agent simulation engine (primary/detour/integrator flows)
        Editor.tsx         # Monaco editor with Yjs bindings
        Terminal.tsx       # xterm.js terminal component
        FileTree.tsx       # File explorer sidebar
      Features.tsx       # Landing page feature grid
      Hero.tsx           # Landing page hero section
    lib/
      orchestrator.ts    # Orchestrator AI: agent registry, conflict detection, flow routing
      yjs.ts             # Yjs document + WebSocket provider factory
  workspaces/            # Server-managed workspace directories (created at runtime)
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## Team

- Pratham Saraf
- Krish Murjani
- Siddh Mandirwala

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Built with long nights and too much caffeine at **YHack 2026**.

</div>
