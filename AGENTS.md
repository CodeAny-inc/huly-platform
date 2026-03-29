# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Huly Platform is a large Rush monorepo (Rush v5.158.1 + pnpm v10.15.1) with 500+ packages.
It includes a Svelte frontend, Node.js/TypeScript backend services, and Rust/Go microservices.
See `README.md` for full setup docs and `ARCHITECTURE_OVERVIEW.md` for service topology.

### Prerequisites (already installed in the VM snapshot)

- Node.js >= 20 (v22 works)
- Docker + Docker Compose (with fuse-overlayfs for DinD)
- Rush (`npm install -g @microsoft/rush`)
- `/etc/hosts` must contain `127.0.0.1 huly.local` and `::1 huly.local`

### Key commands

| Task | Command |
|---|---|
| Install deps | `rush install` |
| Build all | `rush build` |
| TypeScript validate | `rush validate` |
| Lint/format | `rush format --to <pkg>` |
| Unit tests | `rush test --to <pkg>` (or `rushx test` inside a package dir) |
| Svelte check | `rush svelte-check --to <pkg>` |
| Build Docker (min) | `rush docker:min` (from repo root) |
| Build Docker (full) | `rush docker:build` (from repo root) |
| Start services (min) | `rush docker:up:min` (from `dev/` dir) |
| Start services (full) | `rush docker:up` (from `dev/` dir) |
| Dev server (hot reload) | `cd dev/prod && rushx dev-server` → http://localhost:8080 |
| Docker front | http://huly.local:8087 |

### Docker service startup

Docker services are defined in `dev/docker-compose.yaml` with a minified override in `dev/docker-compose.min.yaml`.
The minified stack excludes optional services (elasticsearch, redis, hulypulse, fulltext, preview, link-preview, print, sign, stats, payment, process, backup, rating, hulygun, hulykvs).

Before running `rush docker:up:min`, ensure all required images are built. The `rush docker:min` script builds most images, but **`hardcoreeng/worker`** (used by the `time-machine` service) is not included in the minified build list. Build it separately:
```
rush docker:build --to @hcengineering/pod-worker
```

### Gotchas

- After killing a `rush` command, a stale lock file may remain at `common/temp/rush#<PID>.lock`. Delete it before running another `rush` command.
- `rush validate` takes ~70s on a fresh build. It must complete before `rushx dev-server` can work.
- The dev server (`rushx dev-server`) runs webpack with hot reload. Initial compilation takes ~60s; subsequent recompilations are fast (~1s).
- The Docker front at `:8087` serves pre-built static assets; the webpack dev server at `:8080` is for active development with hot reload.
- Sign-up uses `admin@example.com` / any password in local dev. The `ADMIN_EMAILS` env var in `dev/docker-compose.yaml` controls admin privileges.
