# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers who code with AI agents (Claude Code, Codex, Cursor, scripts) running in parallel on their own machine, mostly on Windows. Several agents and terminals each start the same dev server because nothing tells them it is already running, so the developer ends up with duplicate process trees, fallback ports (3001, 3002…) nobody wrote down, and logs split across tabs.

## Product Purpose

Vigie is a local supervisor for dev servers. It starts each server once, keeps it healthy, and exposes one live state (what runs, on which port, under which PID, healthy or not) that every agent, terminal and window reads instead of spawning a duplicate. Success: one process per server, agents that inspect before they launch, and no silent port fallbacks.

## Positioning

Built for the agent era rather than for process management in general: a JSON CLI and loopback API that agents query first, an agent skill that teaches the "inspect first, launch only if needed" rule, port ownership that names who holds a port (Vigie, another program, or the OS), and a native desktop window with live logs.

## Operating Context

- Desktop app (Electron) with a window and a tray menu; closing the window keeps servers running, quitting stops them.
- CLI `vigie` (`status --json`, `resolve`, `port`, `ports`, `start`, `stop`, `logs -f`, `register`), installable from the tray menu.
- Agent skill installed in `~/.agents/skills/vigie` and `~/.claude/skills/vigie`.
- HTTP API on `127.0.0.1:7744` only, `{ ok, data, error }` envelopes.
- Config in `~/.config/vigie/config.json`, logs in `~/.config/vigie/logs/`.

## Capabilities and Constraints

- Supervises servers through the user's shell (cmd on Windows, `$SHELL -lc` elsewhere) with `PORT`, `VIGIE=1`, `VIGIE_SERVER` in the environment.
- Health checks: TCP on the port or HTTP path with an expected status; unhealthy servers restart with backoff up to `maxRestartAttempts` (default 5), then park as `failed`.
- Refuses to start on an occupied port (`PORT_IN_USE`) and names the owner; `--takeover` only on explicit request. System processes are read-only.
- Restores servers that were running when Vigie stopped; optional launch at login.
- Windows installer (`Vigie-Setup-0.1.3.exe`, unsigned: SmartScreen warns on first run). macOS and Linux builds from source.
- Open source, MIT license. Repository: https://github.com/lyrad9/vigie. Version 0.1.3.
- Not a real PTY: some tools drop colors outside a TTY; interactive prompts are not supported.

## Brand Commitments

- Author: Daryl Ngako (https://lyrad.dev). The site credits him in the footer ("Fait par Daryl Ngako", linked to lyrad.dev) and in metadata; LICENSE copyright is his.
- Name: Vigie (French for a ship's lookout). Logo: blue rounded tile with a lookout ring over three ports (`src/app/icon.svg`).
- Colors: tweakcn "Modern Minimal" theme, light and dark, shared by the app and the site.
- Typography (binding, set by the user): Satoshi for headings, DM Sans for paragraphs. No other font family on the site; code samples use the system monospace stack.
- Site language: French. App UI and CLI output: English.
- Primary action on the landing page: download the Windows installer (GitHub release `releases/latest`); secondary: view the source.
- Landing page reference set by the user: ekklo.com, followed closely in structure and craft, without its script font.

## Evidence on Hand

- Real screenshots of the Vigie desktop app (captured from the running UI with demo projects).
- Real CLI output formats and API responses.
- No users, testimonials, ratings, download counts, logos of customers or press. The user chose to show no social proof at all: do not fabricate or imply any.
- No pricing: the product is free and open source.

## Product Principles

1. Inspect before you launch: the state is the product, the window is one way to read it.
2. Never act silently: nothing is killed or taken over without an explicit request.
3. One process per server, one source of truth for every reader.
4. Local by default: loopback only, no account, no telemetry.
