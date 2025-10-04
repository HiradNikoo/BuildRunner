# Security Overview

BuildRunner adopts a defense-in-depth approach to isolate privileged capabilities and reduce the renderer’s attack surface.

## Surface

Exposed IPC methods are defined centrally in `packages/shared/src/index.ts` and implemented in `packages/main/src/ipc/register.ts`. The renderer only interacts with the API provided by the preload bridge.

## Hardening measures

- **Context Isolation & Sandbox** – The BrowserWindow uses `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false` to prevent direct Node.js access from the renderer.
- **Secure preload** – The preload script exposes a minimal, typed `window.api`. No filesystem or process APIs are directly accessible from React components.
- **Strict CSP** – `Content-Security-Policy` headers enforce `default-src 'self'` with limited allowances for dev tooling.
- **Executable validation** – The main process validates selected executables (existence and permissions) before persisting them, reducing misconfiguration risk.
- **IPC validation** – Argument merging and run orchestration occur in the main process, avoiding reliance on untrusted renderer input for command execution.

## Reporting

Security issues can be reported privately to the maintainers. Please include reproduction steps and platform details so we can triage efficiently.
