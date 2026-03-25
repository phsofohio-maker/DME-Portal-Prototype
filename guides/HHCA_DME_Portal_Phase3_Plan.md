# HHCA DME Portal — Phase 3: Verify, Configure & Deploy

**Harmony Health Care Assistant — DME & Employee Portal**

| Field | Detail |
|-------|--------|
| **Document** | Phase 3 Execution Plan |
| **Version** | 1.0 |
| **Date** | March 24, 2026 |
| **Organization** | Parrish Health Systems of Ohio |
| **Classification** | Internal — Confidential |
| **Status** | Pending IT Lead Review |

---

## 1. Executive Summary

Phase 2 is complete as of March 20, 2026. All six execution blocks shipped: Firebase Authentication replaced the mock login system, every view is wired to Firestore with zero mock arrays in production code, messaging has end-to-end encryption with real-time delivery and read receipts, document history timelines are live on every request, team management supports invite/suspend/role-change/login-history, and email notification Cloud Functions are deployed.

Phase 3 shifts from building to verifying. The primary objectives are to complete the one remaining infrastructure configuration (SMTP credentials for the Trigger Email extension), then systematically inspect every feature built in Phase 2 for correctness, reliability, and data integrity before opening the portal to real users.

**Goal:** Unmock the app completely, connect remaining infrastructure, verify all logic paths, and produce a deployment-ready application.

---

## 2. Phase 2 Completion Summary

The following table captures the ground truth of what was delivered in Phase 2. Every item listed as Complete has code in the repository and has been functionally wired to Firebase services.

| Block | Title | What Was Delivered | Status |
|-------|-------|--------------------|--------|
| Pre | Firebase Project Setup | Auth, Firestore, Functions, Trigger Email extension installed | ✅ Complete |
| 1 | Firebase Auth | Email/password login; mock quick-select in dev mode only | ✅ Complete |
| 2 | Wire Views to Firestore | All data in Firestore; real-time subscriptions; zero mock arrays | ✅ Complete |
| 3 | Messaging | E2E encryption, real-time delivery, read receipts, persisted | ✅ Complete |
| 4 | Document History | HistoryEntry type; color-coded timeline on RequestDetailView | ✅ Complete |
| 5 | Team Management | Invite, suspend, role change, login history; real-time staff state | ✅ Complete |
| 6 | Email Notifications | Cloud Functions for request events and messages; writes to mail collection | ⏳ Pending Config |

**Remaining pre-deploy item:** Block 6 emails will not send until the Trigger Email from Firestore extension is configured in the Firebase Console with SMTP credentials for `notifications@harmonyhca.org`.

---

## 3. Phase 3 Objectives

Phase 3 is organized into six blocks. Each block maps directly to a Phase 2 deliverable and defines the verification criteria, the specific inspections to perform, and the evidence required to mark it as deployment-ready.

---

### Block 1: Verify Firebase Authentication

**Root Cause:** The mock login system (PIN-based, localStorage) was replaced with Firebase Auth email/password in Phase 2 Block 1. The authentication code is deployed, but no structured verification has confirmed every edge case works correctly under real conditions.

#### Scope of Inspection

- Verify email/password sign-in succeeds for all four roles: admin, nurse, homemaker, office_staff
- Verify `onAuthStateChanged` listener correctly hydrates the user session and loads the correct dashboard view per role
- Verify the invitation flow: admin sends invite, new user receives email, clicks link, creates account, lands on onboarding wizard, completes profile, gains correct role access
- Confirm the dev-mode quick-select login is gated behind a build flag and does not appear in production builds
- Verify failed login attempts show descriptive error messages (wrong password, account not found, account suspended)
- Confirm that the legacy `Staff.pin` field has zero runtime references and can be safely removed from `types.ts`
- Verify logout clears all session state and redirects to the login screen

#### Success Criteria

All four role types can log in, see role-appropriate content, and log out cleanly. The invitation-to-onboarding pipeline works end to end. No mock login artifacts exist in production code.

---

### Block 2: Configure & Verify Email Notifications

**Root Cause:** Cloud Functions for email notifications are deployed and writing to the Firestore `mail` collection, but the Trigger Email from Firestore extension has not been configured with SMTP credentials. Until this is done, no emails leave the system.

#### Configuration Steps

1. Open Firebase Console and navigate to Extensions
2. Configure the Trigger Email from Firestore extension with the SMTP credentials for `notifications@harmonyhca.org`
3. Set the mail collection path to match the collection the Cloud Functions write to (`mail`)
4. Run `firebase deploy --only functions` to ensure the Cloud Functions and the extension are in sync

#### Why Trigger Email Instead of SendGrid

The original project plan referenced SendGrid for transactional email. We are using the Firebase Trigger Email extension instead because it integrates natively with Google services we already use, avoids an additional third-party vendor relationship and BAA requirement, keeps the email sending logic inside the Firebase ecosystem where our Cloud Functions already write mail documents, and reduces operational complexity by eliminating API key management for a separate email service.

#### Scope of Inspection

- Submit a new DME request as a nurse and verify that all active admins receive a notification email from `notifications@harmonyhca.org`
- Approve/deny a request as admin and verify the submitting staff member receives a status change email (if their `notificationPrefs.emailOnStatusChange` is true)
- Send a message via the messaging portal and verify the recipient receives a new message email (if their `notificationPrefs.emailOnNewMessage` is true)
- Confirm no clinical data (diagnoses, drug names, ICD-10 codes, message content) appears in any email body
- Verify emails are not sent to suspended staff accounts

#### Success Criteria

All three notification triggers (new request, status change, new message) deliver emails to the correct recipients. Emails contain no PHI. Notification preferences are respected.

---

### Block 3: Verify Document History

**Root Cause:** Phase 2 Block 4 replaced the original audit trail concept with a per-request document history timeline. The `HistoryEntry` interface and Firestore `arrayUnion` logic are deployed. This block verifies the data integrity and UI rendering.

#### Scope of Inspection

- Create a new DME request and verify a `created` history entry is written with the correct actor name, role, and timestamp
- Approve the request and verify an `approved` entry appends via Firestore `arrayUnion` without overwriting the `created` entry
- Test the deny and RMI (Request More Information) flows and verify they each produce correctly typed history entries
- Verify the `RequestDetailView` renders the color-coded vertical timeline: green for created/approved, red for denied, amber for RMI
- Verify admin notes are displayed on history entries where notes were provided
- Confirm history entries are append-only and cannot be edited or deleted by any user role

#### Success Criteria

Every request lifecycle event (create, approve, deny, RMI) produces a history entry with accurate metadata. The timeline renders correctly and is immutable.

---

### Block 4: Verify Messaging Encryption & Functionality

**Root Cause:** Phase 2 Block 3 implemented end-to-end encryption for the messaging portal. Messages are encrypted before Firestore writes and decrypted on read. This block confirms the encryption layer works correctly and that the real-time messaging experience is reliable.

#### Scope of Inspection

- Send a message between two users and verify the message content stored in Firestore is encrypted (not plaintext readable in the Firebase Console)
- Verify the recipient sees the decrypted message correctly in the messaging portal UI
- Verify real-time delivery: a message sent by User A appears in User B's conversation without a page refresh
- Verify read receipts update correctly when the recipient opens the conversation
- Verify Firestore Security Rules enforce sender + recipient only access; a third user cannot read the conversation
- Confirm the messaging portal does not display the "HIPAA COMPLIANT CHANNEL" badge until encryption is independently verified
- Test edge cases: empty messages, long messages, special characters, rapid consecutive sends

#### Success Criteria

Messages are unreadable in raw Firestore, decrypted correctly in the UI, delivered in real-time, and access-controlled to sender and recipient only.

---

### Block 5: Verify Team Management

**Root Cause:** Phase 2 Block 5 fully rewired the TeamView to Firestore with real-time subscriptions. This is the feature the management team will rely on daily. Every capability must be verified to be reliable before deployment.

#### Scope of Inspection

**Invite Flow**
- Admin submits an invitation with name, email, and role assignment
- Verify the invitation document is written to the Firestore `invitations` collection
- Verify the invitation appears in the Pending Invitations section of TeamView in real-time
- Verify async loading and error states display correctly during submission
- Verify the Revoke button removes the invitation and updates the UI in real-time

**Role Management**
- Admin changes a staff member's role via the per-row dropdown and verify it updates in Firestore immediately
- Verify the changed role is reflected in the user's next login session (correct dashboard, correct permissions)
- Verify the admin self-protection: an admin cannot change their own role or suspend themselves ("(you)" label present)

**Suspend / Reactivate**
- Admin suspends a staff member and verify they cannot log in
- Verify suspended users do not receive email notifications
- Admin reactivates a suspended member and verify they can log in again with full access

**Login History**
- Verify `recordLogin()` fires on every successful authentication event
- Verify login history is visible to admins in TeamView with accurate timestamps
- Verify the `logAuthEvent` Cloud Function writes login/logout events to the `audit_log` collection

#### Success Criteria

All team management actions (invite, revoke, role change, suspend, reactivate) work correctly with real-time UI updates. Self-protection prevents admin lockout. Login history is accurate and auditable.

---

### Block 6: Legacy Cleanup & Production Hardening

**Root Cause:** The codebase still carries prototype artifacts that served their purpose during development but must be removed before deployment to real users. Additionally, a full integration walkthrough must confirm end-to-end data flow.

#### Cleanup Tasks

- Remove `services/sourceCode.ts` (prototype AI prompt generator with hardcoded file descriptions)
- Remove `Staff.pin` field from `types.ts` after confirming zero runtime references
- Remove or gate the `MOCK_PATIENTS` array (verify it is no longer imported in production code paths)
- Complete Tailwind CDN to compiled Tailwind migration (remove `cdn.tailwindcss.com` from `index.html`)
- Run `npm audit` and resolve any high or critical vulnerabilities
- Remove or conditionally hide the "HIPAA COMPLIANT CHANNEL" badge in MessagingPortal until encryption verification is documented

#### Integration Walkthrough

After cleanup, perform one complete end-to-end walkthrough of every core workflow to confirm nothing regressed:

1. Login as admin, invite a new nurse, verify the invitation email is received
2. Accept the invitation, create the account, complete onboarding
3. As the new nurse, submit a DME request with ICD-10 code and equipment selection
4. As admin, receive the notification email, review the request in AdminInbox, approve with notes
5. Verify the nurse receives a status change email and sees the approval in document history
6. Send a message from nurse to admin, verify encrypted storage, real-time delivery, read receipt, and notification email
7. Suspend the nurse account, verify they cannot log in, reactivate, verify they can

#### Success Criteria

Zero prototype artifacts in production code. npm audit clean. The full integration walkthrough completes without errors and every notification, history entry, and access control behaves as expected.

---

## 4. Execution Schedule

Phase 3 is estimated at 5 working days of focused effort. Blocks are sequenced so that infrastructure configuration (Block 2) gates the email-dependent inspections in later blocks. Block 1 can run in parallel with Block 2.

| Block | Title | Effort | Depends On | Status |
|-------|-------|--------|------------|--------|
| 1 | Verify Firebase Auth | 0.5 day | None | To Do |
| 2 | Configure & Verify Email | 1 day | SMTP creds | To Do |
| 3 | Verify Document History | 0.5 day | None | To Do |
| 4 | Verify Messaging Encryption | 1 day | None | To Do |
| 5 | Verify Team Management | 1 day | Block 2 | To Do |
| 6 | Legacy Cleanup & Integration Test | 1 day | Blocks 1–5 | To Do |

---

## 5. Infrastructure Prerequisite

There is one configuration step that must be completed before Phase 3 verification can begin on email-dependent features:

| Item | Detail | Owner |
|------|--------|-------|
| SMTP Configuration | Configure the Trigger Email from Firestore extension in the Firebase Console with SMTP credentials for `notifications@harmonyhca.org`. This is the sender address for all automated portal emails. | IT Lead |

This is not a code change. It is a Firebase Console configuration step. Once the SMTP credentials are entered and the extension is active, running `firebase deploy --only functions` completes the wiring and all email triggers become live.

---

## 6. Phase 3 Exit Criteria

Phase 3 is complete when all of the following are true:

| # | Criterion | Status |
|---|-----------|--------|
| 1 | All four roles can log in via Firebase Auth and see role-appropriate content | To Do |
| 2 | Invitation-to-onboarding pipeline works end to end with real email delivery | To Do |
| 3 | All three email notification triggers deliver correctly (new request, status change, new message) | To Do |
| 4 | Emails contain no clinical data (PHI stripped) | To Do |
| 5 | Notification preferences are respected (opt-out users receive no email) | To Do |
| 6 | Document history entries are append-only and render correctly on the timeline | To Do |
| 7 | Messages are encrypted in Firestore, decrypted in UI, and access-controlled to sender + recipient | To Do |
| 8 | Real-time messaging delivery works without page refresh | To Do |
| 9 | Team management: invite, revoke, role change, suspend, reactivate all verified | To Do |
| 10 | Admin self-protection prevents self-role-change and self-suspension | To Do |
| 11 | Login history is accurate and written to audit_log | To Do |
| 12 | sourceCode.ts, Staff.pin, MOCK_PATIENTS, and CDN Tailwind removed from production | To Do |
| 13 | npm audit shows zero high/critical vulnerabilities | To Do |
| 14 | Full integration walkthrough completed without errors | To Do |

---

## 7. What Phase 3 Does Not Cover

The following items from the original project plan are explicitly deferred to Phase 4 (Internal Deployment) or later. This keeps Phase 3 focused on verification of what has been built.

- Patient registry integration (HL7 FHIR R4 or CSV sync) — Phase 4+
- CMS-1500 form pre-population — Phase 4+
- Penetration testing — Phase 4 (requires third-party engagement)
- Staff training materials — Phase 4
- Staged rollout plan — Phase 4
- Multi-tenant architecture — Phase 5+
- Google Cloud BAA execution — parallel legal/admin track (no engineering dependency)
- HIPAA Security Risk Assessment finalization — requires compliance officer review

---

## 8. Requested Actions

1. **IT Lead:** Review this plan and confirm the block structure and exit criteria are acceptable
2. **IT Lead:** Provide the SMTP credentials for `notifications@harmonyhca.org` or configure the Trigger Email extension directly in the Firebase Console
3. **Engineering:** Begin Block 1 (Auth verification) and Block 3 (Document History) immediately — these have no infrastructure dependencies
4. **Engineering:** Begin Block 2 (Email configuration) as soon as SMTP credentials are available
