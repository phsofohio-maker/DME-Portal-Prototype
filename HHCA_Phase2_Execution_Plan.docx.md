  
**HHCA DME Portal**

*Harmony Health Care Assistant DME & Employee Portal*

**Phase 2 Execution Plan**

Claude AI Work Queue \+ Manual Step Handoffs

From Current State to Phase 3 Ready

March 11, 2026 — Version 1.0  
Internal — Confidential

# **1\. How This Plan Works**

This document is a sequential work queue. Each work block is designed to be executed in a single Claude AI session (or a small number of sessions). Blocks are ordered by dependency — you cannot skip ahead without breaking the chain.

**Every block has three parts:**

* **Executor:** Who does the work. “Claude” means I write the code and you review/merge. “You” means it requires your hands (console access, legal action, etc). “Parallel” means you can do it while I work on other blocks.

* **Inputs:** What I need from you before I can start (files, decisions, access).

* **Outputs:** What you get when the block is done (files, test results, a PR-ready diff).

| ⚡  THE RULE When you start a session, tell me which block number you want to execute. I’ll ask for any inputs I need, do the work, and hand you the outputs. We check it off and move on. |
| :---- |

# **2\. Block Sequence Overview**

The blocks are grouped into two sub-phases but executed in a single stream. Your parallel tasks (BAA, pen test scheduling) run on their own track and don’t block engineering work until Phase 4\.

| \# | Block Name | Executor | Est. Sessions | Depends On |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Test Infrastructure Setup | Claude | 1 | — |
| 2 | Firestore Security Rules Tests | Claude | 1–2 | Block 1 |
| 3 | Zod Schema Test Suite | Claude | 1 | Block 1 |
| 4 | Cloud Function Integration Tests | Claude | 1–2 | Block 1 |
| 5 | Session Timeout (HIPAA Logoff) | Claude | 1 | — |
| 6 | Admin MFA Enforcement | Claude | 1 | — |
| 7 | React Component Smoke Tests | Claude | 1 | Block 1 |
| 8 | HIPAA Risk Assessment Draft | Claude | 1 | — |
| 9 | BAA Execution (Google Cloud \+ SendGrid) | You | Parallel | — |
| 10 | Penetration Test Scheduling | You | Parallel | — |
| 11 | Error Handling Hardening | Claude | 1 | — |
| 12 | Optimistic UI \+ Retry \+ Offline Verify | Claude | 1–2 | — |
| 13 | Loading Skeletons | Claude | 1 | — |
| 14 | Request History Timeline | Claude | 1–2 | — |
| 15 | Admin Escalation & Bulk Actions | Claude | 1–2 | — |
| 16 | Notification Preferences | Claude | 1 | — |
| 17 | Accessibility Audit \+ Fixes | Claude | 1–2 | — |
| 18 | Legacy Cleanup | Claude | 1 | — |
| 19 | E2E Test Suite (Playwright) | Claude | 1–2 | Blocks 5–6, 11–18 |
| 20 | Phase 2 Verification & Health Report Update | Both | 1 | All blocks |

| YOUR PARALLEL TRACK (Blocks 9–10) These run alongside the engineering blocks. Start them immediately — they have the longest lead time and are the hardest blockers for Phase 4\. I’ll remind you at the top of each session to check their status. |
| :---- |

# **3\. Phase 2A Blocks — Stabilize & Test**

## **Block 1: Test Infrastructure Setup**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1 |
| Depends on | Nothing — this is the first block |
| Inputs needed | Access to the repo (share files or paste key file contents) |

**What I do:**

* Install and configure Vitest as the test runner (already a Vite project, so Vitest is the natural fit)

* Install @firebase/rules-unit-testing for Firestore Security Rules tests against the emulator

* Install React Testing Library (@testing-library/react \+ @testing-library/jest-dom)

* Create vitest.config.ts with proper TypeScript paths, jsdom environment for React tests, and separate config for rules tests

* Create test helper utilities: mock Firebase Auth context, mock Firestore data factories for Staff, Request, Communication, Invitation

* Create a test/setup.ts with global test configuration

* Add test scripts to package.json: test, test:rules, test:coverage

* Write one smoke test per category (rules, schema, component) to verify the infrastructure works

**What you get:**

* All test config files, ready to run

* Test helper factories that match your actual Firestore schema

* A passing npm test that proves the infrastructure works

* A clear pattern for every subsequent test block to follow

## **Block 2: Firestore Security Rules Tests**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1–2 |
| Depends on | Block 1 (test infra must exist) |
| Inputs needed | Current firestore.rules (already in project knowledge) |

**What I do:**

Write comprehensive tests for all 8 collections against the RBAC matrix defined in the Security Rules. The test file structure mirrors the rules file. For each collection, I test every role (admin, nurse, homemaker, office\_staff, unauthenticated) against every operation (read, create, update, delete).

**Coverage target: 100% of rules.**

**Specific test cases by collection:**

* **staff:** Admin reads any profile; nurse reads only own; create requires admin; update by owner (limited fields) or admin; delete always denied

* **requests:** Submitter reads own; admin reads all; create requires active staff \+ own submitterId \+ pending status \+ all required fields; update admin only; delete denied

* **communications:** Only sender/recipient read; create requires active staff \+ own senderId \+ all required fields; update by recipient (read flag only); delete denied

* **invitations:** Admin-only CRUD; delete denied

* **audit\_log:** Admin reads; all client writes denied (Cloud Functions use Admin SDK)

* **dme\_catalog:** Active staff reads; admin writes; delete by admin

* **patients:** Active staff reads; admin writes; delete denied

* **notifications:** Recipient reads own; recipient updates read flag only; client create denied; delete denied

**What you get:**

* Complete rules test file (test/rules/\*.test.ts)

* Passing test suite with 100% rule path coverage

* Confidence that the RBAC matrix is enforced as documented

## **Block 3: Zod Schema Test Suite**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1 |
| Depends on | Block 1 |
| Inputs needed | Current lib/schemas.ts and functions/src/schemas.ts |

**What I do:**

Write positive and negative test cases for every Zod schema. Each schema gets tested with valid input (should pass) and multiple categories of invalid input (should fail with specific error messages). This catches regressions if schemas are modified later.

* **Client schemas:** dmeFormSchema, medicationFormSchema, multiMedicationFormSchema, adminActionSchema

* **Server schemas:** requestStatusUpdateSchema, newRequestSchema

* Specific edge cases: ICD-10 regex boundaries, RxCUI presence/absence, empty consent arrays, missing e-signature fields, malformed email formats

**What you get:**

* test/schemas/\*.test.ts with full coverage

* Documented edge cases that serve as living specification for valid/invalid input

## **Block 4: Cloud Function Integration Tests**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1–2 |
| Depends on | Block 1 |
| Inputs needed | Current functions/src/index.ts (already in project knowledge) |

**What I do:**

Write integration tests for all 6 Cloud Functions using the Firebase Emulator Suite. Each test verifies that the function produces the correct side effects (audit log entries, notifications, email calls).

* **onRequestCreated:** Verify audit\_log entry created with correct action, actorId, resourceId

* **onRequestUpdated:** Verify audit log \+ notification created for submitter \+ SendGrid called with correct template

* **onStaffUpdated:** Verify audit log for profile changes and suspensions

* **onMessageCreated:** Verify audit log \+ notification to recipient

* **processRequestStatus:** Verify Zod validation rejects bad input; RBAC rejects non-admin; valid call updates request \+ triggers downstream

* **seedCatalog:** Verify admin-only; verify catalog items written correctly

**What you get:**

* test/functions/\*.test.ts

* Verified audit trail completeness — the HIPAA audit controls requirement is now testable

## **Block 5: Session Timeout (HIPAA Automatic Logoff)**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1 |
| Depends on | Nothing |
| Inputs needed | Current App.tsx (the onAuthStateChanged listener location) |

**What I do:**

Implement the 15-minute inactivity timeout required by HIPAA 164.312(a)(2)(iii). The implementation tracks user activity (mouse, keyboard, touch events) and signs out after 15 minutes of inactivity with a warning dialog at 13 minutes.

* Create a useSessionTimeout hook that listens for activity events, debounced

* At 13 minutes idle: show a modal warning with a 2-minute countdown and a “Stay Logged In” button

* At 15 minutes idle: call firebaseService.logout() and redirect to login with an “Inactivity timeout” message

* Write an audit\_log entry for timeout events (auth.timeout action)

* Wire the hook into App.tsx so it’s active on all authenticated routes

* Include a unit test that verifies timeout fires after simulated inactivity

**What you get:**

* hooks/useSessionTimeout.ts

* SessionTimeoutWarning component (modal)

* Updated App.tsx wiring

* Test coverage for the timeout logic

## **Block 6: Admin MFA Enforcement**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1 |
| Depends on | Nothing |
| Inputs needed | Confirmation of which Firebase Auth MFA method (TOTP recommended) |

**What I do:**

Enforce TOTP multi-factor authentication for all admin-role accounts. This is a Firebase Auth native feature. The implementation has two parts: an enrollment flow (admin sets up MFA) and a login gate (admin can’t access the app without completing MFA).

* Create an MFA enrollment component: QR code display for TOTP setup, verification code input, success confirmation

* Modify the login flow: after password auth, check if user is admin \+ MFA not enrolled → force enrollment

* Modify the login flow: after password auth, if MFA is enrolled → prompt for TOTP code before granting access

* Add MFA status indicator to the admin Profile page

* Write audit\_log entry for MFA enrollment and MFA challenge events

**What you get:**

* components/Auth/MFAEnrollment.tsx

* components/Auth/MFAChallenge.tsx

* Updated login flow in App.tsx / LoginPage.tsx

* Admins cannot bypass MFA after enrollment

## **Block 7: React Component Smoke Tests**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1 |
| Depends on | Block 1 |
| Inputs needed | Key component files (LoginPage, DMEForm, AdminInbox, MessagingPortal) |

**What I do:**

Write smoke tests for the critical UI paths using React Testing Library. These are not exhaustive E2E tests (that’s Block 19\) — they verify that components render without crashing, display expected content, and respond to basic interactions.

* **LoginPage:** Renders email/password fields; shows error on invalid input; calls login service on submit

* **DMEForm:** Renders all form sections; validates required fields; shows inline errors on invalid submit

* **MedicationForm:** Renders RxNorm search; validates RxCUI presence

* **AdminInbox:** Renders request list; approve/deny/RMI actions exist; Zod-validated notes field

* **MessagingPortal:** Renders conversation list; send button exists; message input works

* **Dashboard:** Renders KPI cards; request list loads

**What you get:**

* test/components/\*.test.tsx — one file per component

* All tests pass with mocked Firebase services

* Foundation for future component-level regression tests

## **Block 8: HIPAA Security Risk Assessment Draft**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1 |
| Depends on | Nothing |
| Inputs needed | None — I have the full system architecture from project knowledge |

**What I do:**

Draft a HIPAA Security Risk Assessment document that maps every technical safeguard in the system to the specific HIPAA Security Rule requirements (45 CFR 164.308, .310, .312). This is not legal advice — it’s a structured template that a compliance officer or healthcare attorney can review, edit, and finalize.

* Asset inventory: all systems that touch PHI (Firestore, Cloud Functions, Firebase Auth, SendGrid, browser client)

* Threat identification per asset (unauthorized access, data loss, interception, insider threat)

* Vulnerability assessment: what controls exist, what gaps remain

* Risk rating matrix (likelihood x impact) for each identified risk

* Safeguard mapping: each HIPAA requirement → specific implementation in the portal → verification method

* Residual risk documentation: what risks remain after safeguards and what acceptance/mitigation is planned

**What you get:**

* A .docx document: HHCA\_HIPAA\_Security\_Risk\_Assessment\_DRAFT.docx

* Ready for review by your compliance officer or healthcare attorney

| IMPORTANT This is a draft template. A qualified HIPAA compliance professional must review and approve it before it satisfies the 45 CFR 164.308(a)(1) requirement. Do not treat the draft as a completed assessment. |
| :---- |

## **Block 9: BAA Execution (Your Task — Parallel)**

| Field | Detail |
| :---- | :---- |
| Executor | You |
| Timeline | Start immediately; target completion before Phase 4 |
| Depends on | Nothing — this is a legal/administrative task |
| Inputs needed from Claude | None |

**What you do:**

**Google Cloud BAA:**

* Navigate to console.cloud.google.com → your GCP organization → Settings

* Locate the BAA section (or search “Business Associate Agreement” in the console)

* Review and execute the BAA at the organization level (not project level)

* Verify that the BAA covers: Firestore, Cloud Functions, Cloud Storage, Firebase Auth, Cloud Logging

**SendGrid BAA:**

* Contact SendGrid support or your account representative to request a BAA

* Alternative: strip all PHI from notification emails (use generic “You have a new notification” with a portal link instead of including patient names or request details). This eliminates the SendGrid BAA requirement entirely.

**Tell me when done. I’ll update the health report accordingly.**

## **Block 10: Penetration Test Scheduling (Your Task — Parallel)**

| Field | Detail |
| :---- | :---- |
| Executor | You |
| Timeline | Schedule now; test targets Week 11–12 (before Phase 4 go-live) |
| Depends on | Nothing |

**What you do:**

* Identify and engage a third-party penetration testing firm (OWASP Top 10 scope minimum)

* Scope: the staging environment URL, Firebase API endpoints, Firestore Security Rules, authentication flows

* Budget range: $3,000–$10,000 depending on scope depth

* Lead time is typically 4–8 weeks from engagement to report delivery, so starting now is critical

* Request that findings be categorized as Critical / High / Medium / Low with remediation guidance

**Tell me when scheduled. I’ll need the target date to plan remediation work into the timeline.**

# **4\. Phase 2B Blocks — Harden & Polish**

## **Block 11: Error Handling Hardening**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1 |
| Depends on | Nothing (the structured logger already exists) |
| Inputs needed | Current services/logger.ts and any files still using console.log or alert() |

**What I do:**

* Audit every file for console.log, console.error, and alert() calls

* Replace each with the structured logger service (already built) using appropriate severity levels

* Add contextual data to each log call: user role, current route, action being performed, sanitized input data (PHI-safe)

* Verify Error Boundaries exist on all routes; add any missing ones

* Add a user-facing “Report Issue” button on error boundary fallback screens that logs the error context

**What you get:**

* Zero console.log/alert in the codebase (verifiable by grep)

* Every error is structured, contextual, and routed through Cloud Logging

## **Block 12: Optimistic UI \+ Retry Logic \+ Offline Verification**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1–2 |
| Depends on | Nothing |
| Inputs needed | Current form submission flows (DMEForm, MedicationForm, AdminInbox) |

**What I do:**

* Implement optimistic UI for form submissions: show success state immediately, reconcile with Firestore confirmation, rollback on failure with user notification

* Add retry logic with exponential backoff for transient Firestore and network errors (max 3 retries, 1s/2s/4s)

* Verify Firestore offline persistence: test that submissions made while offline are queued locally and synced when connectivity returns (this is a Firestore SDK feature that should already be active since enableMultiTabIndexedDbPersistence is configured)

* Add a connection status indicator: subtle banner when the app detects offline state

**What you get:**

* Form submissions feel instant regardless of network latency

* Transient failures are retried silently; permanent failures show clear user-facing messages

* Offline behavior is verified and documented

## **Block 13: Loading Skeletons**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1 |
| Depends on | Nothing |
| Inputs needed | None — I know the page structure from project knowledge |

**What I do:**

* Create a reusable Skeleton component (animated pulse placeholder)

* Add loading skeletons to every page/component that fetches data: Dashboard (KPI cards \+ request list), AdminInbox (request list), MessagingPortal (conversation list \+ messages), Profile, DME catalog dropdown, Patient search

* Replace all blank-screen loading states with contextually shaped skeletons (card skeleton for KPI cards, row skeletons for lists, etc.)

**What you get:**

* components/ui/Skeleton.tsx

* No more blank flash on any data-loading transition

* Professional loading experience across the app

## **Block 14: Request History Timeline**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1–2 |
| Depends on | Nothing |
| Inputs needed | Current AdminInbox.tsx and the audit\_log query patterns in firebaseService.ts |

**What I do:**

* Add a request detail view (expandable or separate page) that shows the full history timeline for a single request

* Query audit\_log for all entries matching the request’s ID, ordered chronologically

* Render each event as a timeline node: timestamp, actor name \+ role, action taken, admin notes (if any), before/after diff for status changes

* Show the current status prominently at the top with visual status badges

* Include the request’s original submission details (patient, equipment/medication, ICD-10 codes)

**What you get:**

* components/Admin/RequestTimeline.tsx

* Full audit trail visibility per request — satisfies the HIPAA audit review requirement

## **Block 15: Admin Escalation & Bulk Actions**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1–2 |
| Depends on | Nothing |
| Inputs needed | Current AdminInbox.tsx |

**What I do:**

**Escalation:**

* Add an “Assign to” dropdown on each request that lists other admin users

* Add a “Flag for Review” action that marks a request as needing supervisor attention

* Both actions write to the audit\_log and send a notification to the target admin

**Bulk Actions:**

* Add checkbox selection to the AdminInbox request list

* Add a “Bulk Approve” and “Bulk Deny” action bar that appears when 2+ requests are selected

* Each bulk action requires a single note (applied to all selected requests) and processes them sequentially with a progress indicator

* All bulk actions write individual audit\_log entries per request (not one entry for the batch)

**What you get:**

* Escalation flow with admin assignment \+ flag for review

* Bulk approve/deny with progress indication and individual audit trails

## **Block 16: Notification Preferences**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1 |
| Depends on | Nothing |
| Inputs needed | Current NotificationPrefs type from types.ts |

**What I do:**

* Add a notification preferences section to the Profile page

* Allow staff to toggle on/off: email notifications for request status changes, email notifications for new messages, in-app notifications for request updates, in-app notifications for new messages

* Store preferences in the staff document’s notificationPrefs field

* Modify Cloud Functions (onRequestUpdated, onMessageCreated) to check the recipient’s notificationPrefs before sending emails or creating in-app notifications

* Default all preferences to “on” for new accounts

**What you get:**

* Profile page notification settings UI

* Cloud Functions respect per-user preferences

* Staff can control their own notification volume

## **Block 17: Accessibility Audit \+ Fixes**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1–2 |
| Depends on | Nothing |
| Inputs needed | None |

**What I do:**

* Audit all components for WCAG 2.1 AA compliance: keyboard navigation, focus management, ARIA labels, color contrast ratios, form input labeling, error announcement for screen readers

* Add skip-to-content link on all pages

* Ensure all interactive elements are keyboard-reachable and have visible focus indicators

* Add aria-live regions for dynamic content (notifications, form errors, status changes)

* Verify color contrast meets 4.5:1 minimum for normal text, 3:1 for large text

* Add role and aria-label attributes to custom interactive components (modal dialogs, dropdown menus, notification bell)

**What you get:**

* WCAG 2.1 AA compliant markup across all pages

* Accessibility improvements documented in a checklist for the health report

| NOTE Full accessibility verification requires manual testing with a screen reader (VoiceOver, NVDA) on real devices. I can fix all code-level issues, but you should do a manual screen reader walkthrough after this block. I’ll provide a test script. |
| :---- |

## **Block 18: Legacy Cleanup**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1 |
| Depends on | Nothing |
| Inputs needed | None |

**What I do:**

* Remove the “Copy Code for AI” button from the Profile page

* Remove the services/sourceCode.ts file (the prototype’s AI prompt generator)

* Audit for any remaining references to the old PIN-based auth flow and remove them

* Audit for any remaining localStorage references that should be Firestore calls

* Clean up any unused imports, dead code paths, or commented-out prototype code

* Run npm audit and resolve any high/critical dependency vulnerabilities

**What you get:**

* Clean codebase with no prototype artifacts

* npm audit clean (or documented accepted risks for medium/low findings)

## **Block 19: E2E Test Suite**

| Field | Detail |
| :---- | :---- |
| Executor | Claude |
| Sessions | 1–2 |
| Depends on | Blocks 5–6 (session timeout \+ MFA must be in place), Blocks 11–18 (features must be built) |
| Inputs needed | None — runs against Firebase emulator |

**What I do:**

Install Playwright and write end-to-end tests for the 4 core user workflows plus the new Phase 2B features. These tests run against the Firebase Emulator Suite with seeded test data.

* **Workflow 1 — Login:** Email/password auth → dashboard loads → session timeout fires after inactivity → redirect to login

* **Workflow 2 — DME Request:** Login as nurse → navigate to DME form → search patient → select equipment → enter ICD-10 → submit → verify request appears in dashboard

* **Workflow 3 — Medication Request:** Login as nurse → medication form → RxNorm search → select drug → submit → verify in dashboard

* **Workflow 4 — Admin Processing:** Login as admin → inbox shows pending request → approve with notes → verify status change → verify audit trail in timeline → test bulk approve on multiple requests

* **Workflow 5 — Messaging:** Login as nurse → send message to admin → login as admin → verify message received → mark read

* Add Playwright config to CI/CD pipeline (GitHub Actions) so E2E tests run on every PR

**What you get:**

* e2e/\*.spec.ts — comprehensive workflow coverage

* CI/CD integration — no PR merges without passing E2E tests

* Confidence that the entire user flow works end-to-end

## **Block 20: Phase 2 Verification & Health Report Update**

| Field | Detail |
| :---- | :---- |
| Executor | Both |
| Sessions | 1 |
| Depends on | All previous blocks |
| Inputs needed | Current health report from project knowledge |

**What I do:**

* Run the full test suite (unit \+ integration \+ E2E) and capture results

* Run npm audit and capture results

* Generate a test coverage report

* Write the updated Project Health Report (v2.0) reflecting all Phase 2 completions, updated blocker status, and Phase 3 readiness assessment

* Update the Phase 2A and 2B deliverable tables with completion status

**What you do:**

* Review the health report update for accuracy

* Confirm BAA status (Block 9\) and pen test scheduling status (Block 10\)

* Confirm whether manual accessibility testing (screen reader walkthrough from Block 17\) has been done

* Add the updated health report to the project

**Phase 3 Gate Criteria — all must be true:**

* All test suites pass (unit, integration, E2E)

* Test coverage \> 80% (Security Rules: 100%)

* Session timeout and admin MFA are deployed

* HIPAA Risk Assessment draft is under review

* npm audit shows zero high/critical vulnerabilities

* Zero console.log/alert calls in codebase

* Accessibility audit complete (code-level fixes applied)

* BAA execution is in progress or complete (Block 9\)

* Pen test is scheduled (Block 10\)

# **5\. Session Start Protocol**

Use this at the beginning of every working session:

| 📋  SESSION CHECKLIST 1\. Tell me which Block \# you want to work on.2. I’ll ask for any file contents or decisions I need as inputs.3. Share the files (paste contents or upload).4. I build the code and hand you the output files.5. You review, test locally, and merge.6. We mark the block done. |
| :---- |

If you need to share the current state of a file, the fastest approach is to upload it directly. If a file is too large, paste the relevant sections and tell me the file path so I can reference it accurately.

**Between sessions:** If you complete any manual steps (BAA signed, pen test scheduled, screen reader testing done), let me know at the start of the next session so I can update tracking.

*END OF EXECUTION PLAN*  
*Let’s see success. Block 1 when you’re ready.*