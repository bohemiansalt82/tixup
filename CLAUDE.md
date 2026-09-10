# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Tixup is a task/timeline ("Tix") manager. Two frontends live side by side and share one design system:

| Path | What | Status |
|---|---|---|
| `dist/` | Vanilla JS multi-page app (no bundler). This is the working product and what Tauri wraps. | Active |
| `app/` | Vite + React 19 rewrite of the timeline page. Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`. | In-progress port, feature-incomplete (list view is a stub, no auth/spaces) |
| `src-tauri/` | Tauri 2 shell around `dist/` (`frontendDist: ../dist`). Rust commands: `check_initial_setup`, `save_configuration`, `get_configuration`. | Desktop wrapper |

Root `index.html` just redirects to `dist/guide.html` (the component gallery). Root `App.tsx` / `components/Button.tsx` are Figma Code Connect demo files, not part of either app. `test_rust_proj/` is a hello-world scratch crate.

## Commands

**Vanilla app (`dist/`)** — run from repo root:
```
npm install
npm run dev        # http-server ./dist on port 3000
```
Always use port 3000: the Google OAuth client ID in `dist/login.html` is authorized for `http://localhost:3000` only.

**React app (`app/`)**:
```
cd app
npm install
npm run dev -- --port 3000   # vite (same port-3000 rule)
npm run build
npm run lint                 # eslint (flat config, react-hooks + react-refresh)
```

There is no test suite in either app. `dist/test_drag.js` is a stale Playwright script (targets localhost:8080/test_drive.html) and is not wired to anything.

**Tauri**: config in `src-tauri/tauri.conf.json`; no `beforeBuildCommand`, it serves `dist/` as-is. tauri-cli is not a package.json dependency.

## Architecture: timeline coordinate system (shared by both apps)

Both apps use the same px-based model, defined in `dist/assets/js/tixup-constants.js` and `app/src/constants/index.js`:

- `CENTER_PX = 1_000_000` is "today" (`BASE_EPOCH`, midnight of the current day). A task's `start` is an absolute px position relative to that anchor; `width` is px.
- **Stored values are normalized to 48 px/day** (`CELL_WIDTH`). The visible zoom (`currentCellWidth` / `cellWidth`) scales them on render: `visual = CENTER_PX + (stored - CENTER_PX) / 48 * cellWidth`. Always convert with `toVisualLeft/toStoredLeft` (React) or the equivalent math in `saveData()` (vanilla); never persist visual px.
- The scroll canvas is `VIRTUAL_WIDTH = 35000` px wide and is panned with a `translateX(-panOffset)` transform. When scroll nears the edge the viewport "jumps" and the day/month header re-renders (`renderTimelineHeader` / `useTimelineScroll`). This is the source of most historical "teleport" bugs.
- `start < 300000` is treated as corrupt legacy data and reset on load.

Task shape: `{ id, title, status, type: 'parent'|'child', parentId?, start, width, assignee, dueDate, tag, collapsed }`.
Statuses: `pending | inprogress | done | overdue | pause | drop` (legacy `onhold` maps to `pause`). Status drives the CSS class `marker-<status>` and row `data-status`.

## Architecture: vanilla app (`dist/`)

- **No modules, load order matters.** `dist/index.html` loads `tixup-*.js` as plain scripts in dependency order (auth → constants → storage → common → filters → views → task-render → task-crud → selection → timeline-header → timeline-drag → spaces → main). Everything is a global function or lives on `window.TixupState`, `window.TixupAuth`, `window.tixupCore`.
- **The DOM is the source of truth.** `saveData()` (`tixup-storage.js`) rebuilds `TixupState.tasks` by reading rows from the DOM, then writes to localStorage. `renderAll()` clears and re-renders. If you change markup in `renderTask`, check that `saveData()` can still read it back.
- **Three synchronized row lists** joined by `data-group="<task.id>"`: `#grid-tbody` (timeline sidebar), `#timeline-tbody` (bars), `#full-grid-tbody` (list view). `tixupCore.syncTimelineOrder()` re-orders the timeline rows to match the sidebar after drag/drop.
- `TixupCore` (`tixup-common.js`) owns Sortable.js drag-and-drop for parent/child hierarchy, the drop indicator line, expander toggling, and parent auto-resize on double-click of a bar.
- Init functions use an `_done` guard so they can be safely re-invoked (space switching calls them again).
- `debug-mutations.js` is loaded in `index.html` and logs a stack trace whenever a timeline row/bar is removed. Leave it unless removing on purpose.

**Auth & spaces** (`tixup-auth.js`, client-side only, all in localStorage):
- Keys: `tixup-user`, `tixup-active-space`, `tixup-spaces-<userId>`, `tixup-tasks-<spaceId>`, `tixup_zoom`. Legacy `tixup-tasks` is migrated into the first space by `migrateOldData()`.
- Google login uses Google Identity Services with the client ID hardcoded in `login.html`; a demo login path bypasses Google.
- After login, `login.html` redirects to `index.html` (the timeline page).

**Pages**: `index.html` (timeline/list, the main app), `dashboard.html`, `login.html`, `setup.html` (Tauri first-run config, uses `app.js` + `invoke`), `issues.html`, `guide.html` (design system gallery).

## Architecture: React app (`app/`)

- Task state lives in `useTaskStore(spaceId)`: one localStorage list per space under `tixup-tasks-<spaceId>`. `App.jsx` mounts `Dashboard` with `key={activeSpace.id}` so switching spaces remounts and reloads. Each task carries `boxId` (null = no box); children inherit the parent's `boxId`. "My Tasks" shows all tasks in the space, a selected box filters by `boxId`.
- `store/storage.js` holds `SCHEMA_VERSION`; on mismatch every `tixup*` key except `tixup-user` is wiped at startup (`resetLegacyStorage()` in `main.jsx`). Bump it when the stored shape changes incompatibly.
- Auth: `store/useAuth.js` keeps the user in localStorage under `tixup-user` (same key as the vanilla app) and exposes `useAuth()` via `useSyncExternalStore`. `App.jsx` renders `Login` (or `SignUp` at `#signup`) until a user exists. Google login is `utils/googleAuth.js` (GIS token popup + userinfo fetch); the client ID is in `constants/index.js` and can be overridden with `VITE_GOOGLE_CLIENT_ID`. Demo login (name + email) needs no backend. The deployed origin `https://bohemiansalt82.github.io` must be an authorized JavaScript origin for the client ID. `exitingIds`/`newIds` drive enter/exit animations.
- The timeline is **imperative inside React**: `TimelineView` holds refs and `useTimelineScroll` / `useTimelineDrag` mutate `style.transform`, `style.left/width` directly for performance. Bar positions are committed back to the store via `onSaveBarPositions` after drag ends. Do not try to make drag fully declarative without reading both hooks first.
- Routing is hash-based in `App.jsx`: `#signup` → SignUp, no user → Login, otherwise `Dashboard`. `finishLogin()` in `Auth/AuthShared.jsx` clears the hash after login.
- `vite.config.js` sets `base: "/tixup/"` for GitHub Pages. Any image path written in JSX must be prefixed with `import.meta.env.BASE_URL` (see `Sidebar.jsx`); a bare `/images/...` breaks on Pages.
- Class names deliberately mirror the vanilla app so `components.css` works unchanged. Exceptions: the top bar is `components/Layout/TopBar.jsx` + `TopBar.css` (Figma 39519:9833, icons in `public/images/header/`) and the left nav is `components/Layout/Gnb.jsx` + `Gnb.css` (own `gnb-*` classes, icons in `public/images/gnb/`), built from Figma Tixup-V2.0 `GNB_V5` (node 39523:13759, file 4K5p818MM8IKRboMUeDjv6).
- Spaces/boxes: `store/useSpaces.js` (localStorage `tixup-spaces-<userId>`, `tixup-active-space`, `tixup-boxes-<spaceId>`, `tixup-active-box`). Shape: `{ id, name, visibility: "private"|"public", members: string[] }`; `members` (invited emails) is UI-only, nothing is sent. A default "My Space" is created on first use. Invites: `store/invites.js` builds `#invite=<base64url JSON>` links (space id/name/visibility/inviter); `App.jsx` stashes an incoming invite in sessionStorage, and once a user is signed in `joinSpace()` adds the space locally and activates it. This shares the space identity only, not its tasks (no backend). `components/Modals/InviteModal.jsx` (Figma 39528:14464) tokenises emails via `TokenEmailInput.jsx`, blocks Invite on red (invalid) tokens, copies the link, and hands off to `mailto:`; `public/email/invite.html` is the HTML email template (placeholders `{{SPACE_NAME}}` etc., `?space=&by=&link=` for preview). Creation goes through `components/Modals/MakeModal.jsx` (Figma 39521:11825 / 39523:13450), rendered via a portal because the GNB's `backdrop-filter` would trap `position: fixed`.

## Design system & CSS

- `tokens.css` (CSS custom properties, `--primitive-*` / semantic tokens) is exported from Figma; `design-tokens.tokens.json` at root is the source. `icons.css` defines `.icon-*` classes (data-URL SVGs, added to avoid local CORS issues). `components.css` has all component styles (`.btn`, `.marker`, `.data-grid-*`, `.timeline-*`).
- **`app/src/*.css` are copies of `dist/assets/css/*.css`.** `tokens.css` and `icons.css` are currently identical; `components.css` has diverged. When changing shared styles, decide whether both copies need the edit.
- Figma: file key `xwanZD5vsxAboXxX1t58FC` (Tixup). Code Connect is configured in `figma.config.json` (`**/*.figma.tsx`); `Marker.figma.tsx` maps the Figma Marker variants to `.marker marker-<color>`. Fonts: Pretendard via jsdelivr, Material Icons Outlined.

## Conventions

- Commit messages are mixed Korean/English; both are fine.
- User-facing UI text and code comments are often Korean.
- The Claude MCP config in `.claude/settings.json` points at a local Figma desktop server (`127.0.0.1:3845`).
