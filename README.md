# BuildRunner

BuildRunner is a cross-platform desktop companion that lets you catalog build and automation commands, map them to files, and execute them with precision. It is built with Electron 30, React 18, TypeScript, Vite, and Ant Design.

## Features

- **Command catalog** with executable validation, argument schema builder, CLI previews, and default argument management.
- **File manager** supporting drag & drop import, per-file command selection, override editors, and quick actions (run, reveal, remove).
- **Run queue** with configurable concurrency, dry-run support, and live console streaming (stdout/stderr).
- **Persistent storage** backed by SQLite via `better-sqlite3`, including run history, per-file overrides, and dashboard insights.
- **Dashboard & history** views for quick health checks, recent activity, and deep dive into run artifacts.
- **Secure IPC bridge** with a hardened preload, strict CSP, and sandboxed renderer.

## Monorepo layout

```
packages/
  main/        # Electron main process (tsup build)
  preload/     # Secure IPC bridge
  renderer/    # React + Vite front-end
  shared/      # Shared TypeScript models & IPC contracts
scripts/       # Utilities such as the seed script
tests/         # Vitest unit tests and Playwright E2E smoke test
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 8+

## Getting Started

```bash
pnpm install
pnpm dev
```

The development script launches:

- `pnpm --filter main dev` and `pnpm --filter preload dev` (tsup watch builds)
- `pnpm --filter renderer dev` (Vite dev server)
- Electron with hot reload against the Vite server

### Type checking & linting

```bash
pnpm typecheck
pnpm lint
```

### Unit tests

```bash
pnpm test
```

### E2E smoke test

```bash
pnpm test:e2e
```

This builds the production bundles and launches Playwright’s Electron runner to verify the dashboard loads.

### Packaging

```bash
pnpm build
pnpm make
```

Build artifacts are emitted to `release/` via `electron-builder` for Windows, macOS, and Linux.

### Seed demo data

```bash
pnpm seed
```

Creates `buildrunner-demo.sqlite` with an example `echo` command and sample files for exploration.

## Environment variables

- `VITE_DEV_SERVER_URL` – set automatically in development scripts to point Electron to the Vite dev server.

## Troubleshooting

- Ensure native dependencies (`better-sqlite3`) rebuild correctly for your platform. During packaging, `electron-builder` copies the compiled binary automatically.
- On Unix-like systems, mark custom shell scripts as executable (`chmod +x`). The run queue performs permission checks and will surface actionable errors.

## License

MIT
