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
vigie port 3000 --json       # who holds a port (managed, external, system), which servers are configured on it
```

All commands print JSON with `--json`. Errors are `{ "ok": false, "error": { "code", "message" } }`.

## 2. Decide

| What you see | Do |
|---|---|
| Server `state: "running"` and `healthy: true` | Use its `url`. Do not start anything. |
| `state: "starting"` or `"restarting"` | Wait, then re-check `vigie status --json`. Its port is taken even while nothing answers on it. |
| `state: "stopped"` or `"failed"` | `vigie start <project/server> --json` |
| `state: "unhealthy"` | Read `vigie logs <server> --lines 80`, then fix or `vigie restart <server>`. |
| `resolve` returns `project: null` | Pick a port (next row), then register once: `vigie register --command "<cmd>" --port <n>`, and start it. `inspect.suggestion` already skips ports other servers have; `portMovedFrom` and `portTakenBy` say why. |
| You need a port for a new server | Run `vigie status --json` and rule out every `port` of every server, in every project, whatever its `state`. Then `vigie port <n> --json` must list no `owners` and no `configured` server. A port nothing listens on is not enough: a server that is restarting does not listen. |
| `PORT_CONFLICT` from `register` | Another server is configured on that port. Re-run with `--port <error.details.suggestedPort>`. Add `--share-port` only if the user confirms the two never run at the same time. |
| `PORT_IN_USE` with a `managed` owner | Another Vigie server holds the port (`listening: false` while it starts or restarts). Use that server, or another port. Do not stop it to free the port. |
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
- A `managed` port with `internal: true` is an extra listener of that server (Next.js workers
  on loopback ports, for instance), not a second copy; `primaryPort` is the server's own port.
- The HTTP API is at `http://127.0.0.1:7744/api` (`GET /status`, `POST /servers/<ref>/start`…).
- `vigie: command not found`? Ask the user to choose **Install command-line tool** in the Vigie
  tray menu, then open a new terminal. Meanwhile, read `GET http://127.0.0.1:7744/api/status`.
