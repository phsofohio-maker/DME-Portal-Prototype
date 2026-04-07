#!/usr/bin/env bash
set -euo pipefail

# ── Ensure Java is on PATH (nix-env installed JDK) ──────────────────────────
export PATH="$HOME/.nix-profile/bin:$PATH"

# ── Detect system Chromium for Playwright ────────────────────────────────────
CHROMIUM_PATH=$(which chromium 2>/dev/null || true)
if [ -n "$CHROMIUM_PATH" ]; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$CHROMIUM_PATH"
fi

# ── Build Cloud Functions (required for emulator) ────────────────────────────
echo "Building Cloud Functions..."
npm --prefix functions run build

# ── Run Playwright inside Firebase Emulator lifecycle ────────────────────────
# emulators:exec starts Auth + Firestore + Functions emulators, runs the
# command, then tears everything down automatically.
echo "Starting Firebase Emulators and running E2E tests..."
firebase emulators:exec \
  --only auth,firestore,functions \
  --project dme-portal-prototype \
  "npx playwright test --project=chromium"
