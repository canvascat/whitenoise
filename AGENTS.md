# AGENTS.md

## Cursor Cloud specific instructions

This is a frontend-only PWA (`白噪声`, a white-noise player) built with React 19 + the
**Vite+** toolchain. There is no backend/database — everything runs in the browser and
audio/scene assets are served statically from `public/assets/`.

### Toolchain: `vp` (Vite+)

All standard commands are run through the global `vp` CLI (see `CLAUDE.md` and the CI
workflow in `.github/workflows/ci.yml`). `vp` manages the Node.js version (24) and the
package manager (pnpm) automatically — do **not** rely on the system Node/`nvm`.

- **Non-interactive gotcha:** `vp` is added to `PATH` by `~/.bashrc`/`~/.profile`, so it is
  available in normal interactive shells. In non-interactive scripts (or if `vp` is
  "command not found"), first run `. "$HOME/.vite-plus/env"` to load it. The update script
  already does this.
- Standard commands (all from repo root): `vp install`, `vp check` (format + lint +
  typecheck), `vp test --run` (Vitest), `vp run build` (runs `tsc` then `vite build`),
  `vp dev` (dev server on `http://localhost:5173/`). Note that `build` is a package.json
  script, so it must be invoked as `vp run build`, not `vp build`.

### Running / testing

- Dev server: `vp dev` → `http://localhost:5173/`. The app opens on the `推荐` (recommend)
  scene page; the `自选` tab is the custom sound mixer.
- Audio requires a user gesture (click) to start due to browser autoplay policy — this is
  expected, not a bug.
