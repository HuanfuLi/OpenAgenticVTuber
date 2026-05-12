# Phase 1 Browser Prototype Archive

This directory preserves the obsolete root-level browser prototype that used
`window.MOCK` and `src/lib/mock.js`.

The active app entrypoint is the Electron/Vite renderer under `apps/renderer`.
Production mock-boundary tests assert that root `index.html` and root `src/`
do not return as runtime entrypoints.
