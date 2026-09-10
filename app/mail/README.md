# Backend (Google Apps Script)

The React app has no server of its own. A small Google Apps Script web app running under the
owner's Google account does two things:

1. **Invitation mail** — sends invite emails from Gmail.
2. **Shared space storage** — keeps each space's Tix list as a JSON file in the owner's Drive
   (folder "Tixup Data"), so everyone who opens an invite link sees the same Tix.

Free, no domain needed.

## One-time setup

1. Open https://script.google.com → **New project**.
2. Replace the contents of `Code.gs` with [`Code.gs`](./Code.gs) in this folder. Save.
3. **Deploy → New deployment** → type **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click Deploy, approve the Gmail **and Drive** permission prompts, copy the **Web app URL** (ends with `/exec`).
4. Paste the URL into `API_ENDPOINT` in `app/src/constants/index.js` (it is public in the
   bundle anyway, so a repo variable adds nothing). `VITE_API_ENDPOINT` in a `.env` file
   overrides it for local runs (`VITE_INVITE_MAIL_ENDPOINT` still works as a fallback name).
5. Push — the GitHub Pages workflow rebuilds with the endpoint baked in.
6. Open the app once as the space owner: the first visit publishes the existing local Tix list
   to the backend. From then on invitees see it.

## How it works

All calls are `POST <endpoint>` with a `text/plain` JSON body (no CORS preflight, which Apps Script requires).

| Body | What happens |
|---|---|
| `{ to, space, inviter, link }` | Sends the invite email (fetches `public/email/invite.html`, fills placeholders, `MailApp.sendEmail`). |
| `{ action: "load", space: "<id>", member?: { email } }` | Returns `{ found, space, tasks, rev, updatedAt }`; records `member.email` on the space. |
| `{ action: "save", space: { id, name, visibility }, tasks, by?: { name, email } }` | Replaces the task list, bumps `rev`, remembers the first saver as owner. Last write wins. |

Client side (`src/store/useTaskStore.js` + `src/store/remote.js`):
- localStorage stays the instant store; on mount, window focus, and every 15 s the app pulls the
  remote list and applies it when `rev` changed.
- Every local edit is pushed after a 700 ms debounce (and flushed on space switch / page hide).
- If the backend has no document for a space yet, the browser's local list is published (bootstrap).
- Invite links are short (`#join=<spaceId>`); the name and inviter are resolved with a `load` call.
- With an empty endpoint the app is local-only, links carry the full payload (`#invite=…`), and invitations fall back to `mailto:`.

Guards: valid-email filter, max 10 recipients per request, 30 invite requests/hour per inviter,
link must start with `https://`, space ids `[A-Za-z0-9_-]{1,64}`, documents up to 4 MB.
Gmail's own daily quota applies (~100/day for personal accounts).

## Updating the script

Edit `Code.gs` here, paste into the Apps Script editor, then **Deploy → Manage deployments →
Edit → New version**. The URL stays the same. A new version that needs extra scopes (e.g. Drive)
asks for permission again on deploy.
