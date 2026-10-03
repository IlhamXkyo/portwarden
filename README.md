# Portwarden 🛡️

> Developer Port Collision Inspector, Zombie Process Terminator, and Port Sentinel.

[![CI](https://github.com/IlhamXkyo/portwarden/actions/workflows/ci.yml/badge.svg)](https://github.com/IlhamXkyo/portwarden/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

---

## The Problem

Every developer experiences this scenario:

```bash
Error: listen EADDRINUSE: address already in use :::3000
```

1. **Zombie Dev Servers**: A terminal tab or code editor is closed, but the background `node`, `vite`, `python`, or `docker` process stays alive holding port 3000 or 8080.
2. **Port Roulette**: Build tools automatically switch to port 3001 or 5174, breaking OAuth redirects, CORS allowances, and API proxy configs.
3. **OS-Specific Headaches**:
   - On Windows: Remembering `netstat -ano | findstr :3000`, parsing the PID, and running `taskkill /F /PID <pid>`.
   - On macOS/Linux: Running `lsof -ti:3000 | xargs kill -9`.
   - Existing npm packages (`kill-port`) often fail silently on Windows, lack process verification, and blindly kill processes without showing you what process is actually listening.

**Portwarden solves this instantly** with zero external dependencies, cross-platform reliability, and verified release polling.

---

## Quick Start

Run instantly without global installation using `npx`:

```bash
# Inspect port 3000 (shows PID, process name, memory, and address)
npx portwarden 3000

# Terminate whatever is on port 3000 and verify it is released
npx portwarden free 3000

# Scan active common development servers (Next, Vite, Django, Postgres, etc.)
npx portwarden dev

# Sweep and terminate all lingering dev servers with confirmation
npx portwarden sweep
```

Or install globally:

```bash
npm install -g portwarden
```

---

## Features

- **Port Inspection**: Displays PID, process name, memory usage (RSS), and local binding address in a clean terminal table.
- **Verified Port Release**: Terminates the owning process (graceful SIGTERM/taskkill first, auto-escalates to force kill if stubborn) and actively polls to ensure the socket is truly free before returning.
- **Dev Port Catalog**: Pre-configured recognition for standard web frameworks and databases (ports 3000, 3001, 4000, 4200, 5000, 5173, 8000, 8080, 5432, 6379, etc.).
- **Dev Sweep**: Clean all zombie dev servers in a single command (`portwarden sweep --yes`).
- **Safety First**: Refuses to kill protected OS processes (Windows PID 0/4, Unix PID 1), provides `--dry-run` preview, and requires confirmation by default for sweep operations.
- **Find Next Free Port**: Finds the next available unoccupied port starting from a given number (`portwarden next 3000`).
- **Wait for Port**: Blocks until a port opens or closes (`portwarden wait 3000 --until-ready`). Ideal for CI scripts and test runners.
- **Machine-Readable JSON**: Pass `--json` to integrate with scripts, CI pipelines, or editor extensions.
- **Zero Runtime Dependencies**: Built entirely with Node.js built-in APIs (`node:child_process`, `node:net`, `node:readline`). Fast startup and zero security vulnerabilities.

---

## Command Reference

### 1. Inspect Port(s)

```bash
# Inspect a single port
portwarden 3000

# Inspect multiple ports
portwarden 3000 5173 8080
```

Sample output:
```text
  PORTWARDEN - Developer Port & Zombie Process Sentinel

PORT   STATUS      PID    PROCESS     MEMORY     ADDRESS
────   ─────────   ────   ─────────   ────────   ───────
3000   OCCUPIED    14920  node.exe    142.4 MB   0.0.0.0
5173   AVAILABLE   -      -           -          -
8080   OCCUPIED    8120   java.exe    310.2 MB   127.0.0.1
```

### 2. Free / Kill Port(s)

```bash
# Free port 3000 (graceful attempt followed by force kill if needed)
portwarden free 3000

# Force kill immediately
portwarden free 3000 --force

# Free multiple ports
portwarden free 3000 8080 5173

# Preview without terminating (dry-run)
portwarden free 3000 --dry-run
```

### 3. Dev Ports Scanner

```bash
# Scan active developer ports
portwarden dev

# Include databases (PostgreSQL, MySQL, Redis, MongoDB)
portwarden dev --all
```

### 4. Dev Sweep

```bash
# Sweep active dev servers (prompts for confirmation)
portwarden sweep

# Sweep immediately without confirmation prompt
portwarden sweep --yes

# Sweep all dev servers including databases
portwarden sweep --all --yes
```

### 5. Find Next Available Port

```bash
# Find next free port starting from 3000
portwarden next 3000

# Output as JSON
portwarden next 3000 --json
# Output: { "availablePort": 3000, "startPort": 3000 }
```

### 6. Wait For Port

```bash
# Wait for dev server to start listening (useful before running E2E tests)
portwarden wait 3000 --until-ready --timeout 15000

# Wait for server to stop (useful during teardown)
portwarden wait 3000 --until-free
```

---

## Programmatic API

You can also use Portwarden as a Node.js library in your scripts or test setups:

```javascript
import {
  inspectPort,
  freePort,
  findAvailablePort,
  waitForPort,
  scanDevPorts
} from 'portwarden';

// Inspect a port
const info = inspectPort(3000);
if (info.occupied) {
  console.log(`Port 3000 is occupied by ${info.processName} (PID ${info.pid})`);
}

// Free a port programmatically
const result = await freePort(3000, { force: true });
if (result.success) {
  console.log('Port 3000 freed successfully!');
}

// Find next available port for dynamic test servers
const port = await findAvailablePort(3000);

// Wait for a server to spin up
await waitForPort(3000, { status: 'open', timeoutMs: 5000 });
```

---

## Platform Support

- **Windows**: Windows 10, 11, Windows Server (uses native `netstat`, `tasklist`, and `taskkill`)
- **macOS**: Apple Silicon and Intel (uses native `lsof` and `ps`)
- **Linux**: Ubuntu, Debian, Alpine, Fedora, Arch (uses native `lsof`, `ss`, and `ps`)

---

## Testing

Portwarden includes automated unit and integration tests using Node's built-in test runner:

```bash
npm test
```

---

## License

MIT (c) 2026 IlhamXkyo
