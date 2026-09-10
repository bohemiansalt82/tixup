# Invite mailer (Google Apps Script)

The React app has no backend, so invitation emails are sent by a small Google Apps
Script web app running under the owner's Google account (Gmail). Free, no domain needed.

## One-time setup

1. Open https://script.google.com → **New project**.
2. Replace the contents of `Code.gs` with [`Code.gs`](./Code.gs) in this folder. Save.
3. **Deploy → New deployment** → type **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click Deploy, approve the Gmail permission prompt, copy the **Web app URL** (ends with `/exec`).
4. Paste the URL into `INVITE_MAIL_ENDPOINT` in `app/src/constants/index.js` (it is public in the
   bundle anyway, so a repo variable adds nothing). `VITE_INVITE_MAIL_ENDPOINT` in a `.env` file
   overrides it for local runs.
5. Push — the GitHub Pages workflow rebuilds with the endpoint baked in.

## How it works

- App → `POST <endpoint>` with `{ to, space, inviter, link }` (text/plain body, no preflight).
- Script fetches `public/email/invite.html` from the live site, fills the placeholders,
  and sends via `MailApp.sendEmail` (HTML + plain text) to each recipient.
- Guards: valid-email filter, max 10 recipients per request, 30 requests/hour per inviter,
  link must start with `https://`. Gmail's own daily quota applies (~100/day for personal accounts).
- With an empty endpoint the app falls back to opening the user's mail client (`mailto:`).

## Updating the script

Edit `Code.gs` here, paste into the Apps Script editor, then **Deploy → Manage deployments →
Edit → New version**. The URL stays the same.
