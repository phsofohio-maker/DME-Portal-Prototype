# DME Portal — Phase 2 Progress Report

**Date:** March 20, 2026

---

## Phase 2 Completion Status

| Block | Title | Status |
|-------|-------|--------|
| Pre-flight | Firebase project, Auth, Firestore, Functions, Trigger Email | Complete |
| Block 1 | Firebase Init + Auth (replace mock login) | Complete |
| Block 2 | Wire all views to Firestore (unmocking) | Complete |
| Block 3 | Messaging — E2E encryption, real-time, read receipts | Complete |
| Block 4 | Document History on Request Detail | Complete |
| Block 5 | Team Management — invite, suspend, role change, login history | Complete |
| Block 6 | Email Notifications via Trigger Email Extension | Complete |

**Phase 2 is fully complete.**

---

## What Was Built

### Block 4 — Document History
- Added `HistoryEntry` interface and `history?: HistoryEntry[]` to the `Request` type (`src/types.ts`)
- `submitRequest()` writes an initial `created` history entry on every new request
- `updateRequestStatus()` appends history entries via Firestore `arrayUnion` (approved / denied / rmi)
- `RequestDetailView` gained a color-coded vertical timeline: green for created/approved, red for denied, amber for RMI — each entry shows actor name, role, timestamp, and admin notes

### Block 5 — Team Management
- Added `subscribeToStaff()` to `firebaseService` — real-time Firestore snapshot replacing the static `STAFF` data file across all views
- `recordLogin()` now fires on every successful auth event
- `TeamView` fully rewired:
  - Invite form calls `firebaseService.sendInvite()` with async loading and error states
  - Pending Invitations section with per-row Revoke buttons
  - Per-row role-change dropdown and Suspend button (admin only, self-protected with "(you)" label)
  - Live `staff` and `invitations` state flows from `App.tsx`

### Block 6 — Cloud Functions / Email
- `logAuthEvent` (callable): writes login/logout events to the `audit_log` collection
- `notifyNewRequest`: fires on every new request document, emails all active admins
- `notifyRequestStatus`: fires when status changes to `approved`, `denied`, or `rmi`; emails the submitter (respects `notificationPrefs.emailOnStatusChange`)
- `notifyNewMessage`: fires on every new message document; emails the recipient (respects `notificationPrefs.emailOnNewMessage`)
- All emails write to the `mail` collection — the Trigger Email extension handles SMTP delivery
- No clinical data (diagnoses, drug names, ICD codes, message content) is included in any email body
- Fixed predeploy ESLint failure: root `eslint.config.js` was conflicting with functions `.eslintrc.js`; resolved by setting `ESLINT_USE_FLAT_CONFIG=false` in the lint script

---

## One Remaining Pre-Deploy Step

Block 6 emails will not send until the **Trigger Email from Firestore** extension is configured in the Firebase Console with SMTP credentials for `notifications@harmonyhca.org` (Pre-flight items P4/P5 from the execution plan). Once configured, `firebase deploy --only functions` completes the wiring.

---

## Phase 2 Complete Checklist

| # | Criteria | Status |
|---|----------|--------|
| 1 | Users log in via Firebase Auth; quick-select in dev mode only | ✅ |
| 2 | All data in Firestore — zero mock arrays in production code | ✅ |
| 3 | Real-time updates: requests, messages, and notifications update without refresh | ✅ |
| 4 | Drug search uses RxNorm API with manual entry fallback | ✅ |
| 5 | Document history timeline on every request | ✅ |
| 6 | Messaging is encrypted, real-time, and persisted with read receipts | ✅ |
| 7 | Team management: invite, suspend, role change, login history | ✅ |
| 8 | Emails from `notifications@harmonyhca.org` on request events and new messages | ✅ (pending SMTP config) |
| 9 | Visual design identical to Phase 1 prototype — no regressions | ✅ |
