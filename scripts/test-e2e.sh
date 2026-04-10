#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# E2E test runner — boots Firebase emulators and runs the Playwright suite.
#
# This script is the local equivalent of .github/workflows/e2e.yml and is the
# canonical way to run the E2E suite. Authoritative environment is GitHub
# Actions; this script is a best-effort local alternative.
#
# REQUIREMENTS for local execution:
#   1. Java 21+ on PATH (Firebase emulators since firebase-tools 14)
#   2. A Chromium-compatible browser. Two paths:
#        a. System Chromium auto-detected via `which chromium` (this script
#           sets PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH for Playwright).
#        b. Playwright's bundled Chromium (`npx playwright install chromium`)
#           — requires standard Linux GUI shared libs (libnss3, libglib, etc).
#   3. Built Cloud Functions (this script runs `npm --prefix functions build`).
#
# KNOWN LIMITATION — IDX / Nix-based dev environments:
#   The IDX (Google Cloud Workstation, Nix-based) environment ships with a
#   system Chromium that's a different version than the one Playwright was
#   built against, AND has only 64 MB of /dev/shm. This combination causes
#   the headless browser to crash mid-test ("Target crashed" / renderer OOM)
#   even with --disable-dev-shm-usage. The tests are correct and run cleanly
#   in standard CI (GitHub Actions runners have all required deps and a full
#   /dev/shm) — see .github/workflows/e2e.yml. If you need to verify locally,
#   use a standard Linux dev container with `npx playwright install --with-deps`
#   rather than IDX.
# ─────────────────────────────────────────────────────────────────────────────

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
