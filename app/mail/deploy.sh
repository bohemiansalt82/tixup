#!/usr/bin/env bash
# Push app/mail/Code.gs to the Apps Script project and publish a NEW VERSION of the existing
# web-app deployment (the /exec URL stays the same). One-time setup: `npx @google/clasp login`
# (owner's Google account) and a `.clasp.json` here with the scriptId (see README).
set -euo pipefail
cd "$(dirname "$0")"
[ -f .clasp.json ] || { echo ".clasp.json missing — see README 'Deploying with clasp'"; exit 1; }
npx --yes @google/clasp push --force
DEPLOYMENT_ID="${DEPLOYMENT_ID:-$(npx --yes @google/clasp deployments | awk '/@[0-9]+ - /{id=$2} END{print id}')}"
[ -n "$DEPLOYMENT_ID" ] || { echo "no web-app deployment found; pass DEPLOYMENT_ID=..."; exit 1; }
npx --yes @google/clasp deploy -i "$DEPLOYMENT_ID" -d "${1:-$(date +%F) Code.gs}"
# Verify the live version.
EP="$(sed -n "s/.*'\(https:\/\/script.google.com\/macros\/s\/[^']*\/exec\)'.*/\1/p" ../src/constants/index.js | head -1)"
echo "live: $(curl -sL "$EP?action=ping")"
