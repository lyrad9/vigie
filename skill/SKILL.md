---
name: vigie
description: Use before starting, restarting or killing any local dev server (npm/pnpm/yarn/bun dev, next dev, vite, rails s, manage.py runserver…), before picking a port, or when a port is "already in use". Vigie supervises every local server; read its live state instead of spawning a duplicate.
---

# Vigie: inspect first, launch only if needed

Vigie is a local supervisor for dev servers. It already knows what is running, on which
port, under which PID, and whether it is healthy. Other agents and terminals share it.

**The one rule: never start a dev server yourself before asking Vigie.** No `npm run dev &`,
no background jobs, no "try port 3001 instead".

## 1. Inspect

```bash
vigie status --json          # every project, server, port, pid, state, health
vigie resolve --json         # the server registered for the current directory
vigie port 3000 --json       # who owns a port: managed, external or system
```

All commands print JSON with `--json`. Errors are `{ "ok": false, "error": { "code", "message" } }`.

## 2. Decide

| What you see | Do |
|---|---|
| Server `state: "running"` and `healthy: true` | Use its `url`. Do not start anything. |
| `state: "starting"` | Wait, then re-check `vigie status --json`. |
| `state: "stopped"` or `"failed"` | `vigie start <project/server> --json` |
| `state: "unhealthy"` | Read `vigie logs <server> --lines 80`, then fix or `vigie restart <server>`. |
| `resolve` returns `project: null` | Register it once: `vigie register --command "<cmd>" --port <n>`, then start it. |
| `PORT_IN_USE` with an `external` owner | Tell the user which process holds the port. Only run `vigie start <server> --takeover` if they agree. |

## 3. Read

```bash
vigie logs <server> --lines 100     # recent output (survives restarts)
```

Read logs instead of starting a second copy "to see the output".

## Notes

- `<server>` accepts an id, `project/server`, `:3000`, or a unique server name. Without an
  argument, `start`, `stop`, `restart` and `logs` use the server registered for the cwd.
- Servers get `PORT` in their environment. For Vite-like tools, keep `--port <n> --strictPort`
  in the command so they never fall back to another port silently.
- Never kill processes Vigie reports as `system`. Never use `--takeover` without the user's OK.
- The HTTP API is at `http://127.0.0.1:7744/api` (`GET /status`, `POST /servers/<ref>/start`…).
- `vigie: command not found`? Ask the user to choose **Install command-line tool** in the Vigie
  tray menu, then open a new terminal. Meanwhile, read `GET http://127.0.0.1:7744/api/status`.
