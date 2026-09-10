# Dependency Notes

Running record of dependency decisions that are not obvious from `package.json`.
Check this file before "fixing" an advisory that appears to have been ignored.

## Accepted risk: `xlsx` (SheetJS)

`xlsx@0.18.5` carries two advisories that `npm audit` reports as **"No fix
available"**:

| Advisory | Severity |
| :--- | :--- |
| [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) — Prototype pollution | High |
| [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) — ReDoS | High |

**Why there is no fix on npm:** SheetJS stopped publishing to the npm registry
after 0.18.5. Patched releases are distributed from the vendor's own CDN
(`https://cdn.sheetjs.com/`), so `npm audit` will keep reporting these
indefinitely regardless of how many times the lockfile is regenerated.

**Where it is used:** card import/export in
`src/components/manager/tabs/CardsTab.tsx`, and nowhere else. It is
manager-only, and since the tab is lazily loaded it no longer ships to kiosk
clients at all.

**Exposure:** both advisories require parsing a malicious spreadsheet. The only
way to reach that code path is an authenticated admin choosing a file to
import. There is no unauthenticated path to it.

**Status: accepted.** Revisit if card import is ever exposed to non-admins.

Options if it needs to be resolved:
1. Point the dependency at the SheetJS CDN tarball (their documented install path).
2. Replace with a maintained reader such as `exceljs`.
3. Drop the dependency and use CSV, which needs no library.

## `overrides` in package.json

Two transitive pins that `npm audit fix` could not apply on its own:

- **`path-to-regexp: 0.1.13`** — `express@4` pins `0.1.12` exactly, which has a
  ReDoS advisory. `0.1.13` is the patch that fixes it and is otherwise a drop-in.
- **`protobufjs: ^7.6.6`** — `@google/genai` resolves `7.5.4`, which has a
  critical code-execution advisory (affects `<=7.6.4`). `7.6.6` stays inside the
  same major it was resolved against.

Remove either override once the parent package ships a fixed range itself.

## Known remaining advisories (production tree)

`npm audit --omit=dev` reports 4, all deliberate:

- **`xlsx`** — see above.
- **`express` / `qs`** — moderate; the only fix npm offers is Express 5, a major
  upgrade with breaking routing changes. Not worth it for this app right now.
- **`esbuild`** — low, and it is a Windows-only dev-server issue. This deploys
  to Linux containers.

## Why `vite` is a devDependency

`server.ts` imports Vite lazily (`await import("vite")`) inside the
`NODE_ENV !== "production"` branch, so the dev server middleware never loads in
production. Keeping Vite out of `dependencies` removes it — plus `@babel/core`,
`browserslist`, `postcss` and `nanoid` — from the production image entirely.

**Do not convert that back to a static top-level import.** It would drag the
whole build toolchain back into the runtime image and break `npm ci --omit=dev`.
