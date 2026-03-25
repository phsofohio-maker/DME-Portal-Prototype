# HHCA DME Portal — Phase 2 Execution Plan (FINAL)

**Version:** 3.0  
**Date:** March 19, 2026  
**Approved scope:** Unmock the prototype. Connect to Firebase. Verify success.

---

## What This Phase Is

Take every mock array and `useState` shortcut in the prototype and replace it with a real Firebase connection. When Phase 2 is done, two people on different computers can log in, submit requests, approve them, message each other, and manage the team — with all data persisting in Firestore and email notifications landing in real inboxes from `notifications@harmonyhca.org`.

---

## Important Context for Claude Code

The Phase 1 rebuild produced a clean, in-memory prototype. But the **old codebase** (pre-rebuild) already had Firebase-connected versions of several features. These files still exist in the project repository:

| Old Codebase File | What It Does | Reuse Strategy |
|--------------------|-------------|----------------|
| `services/firebaseService.ts` | Full Firestore CRUD, Auth, messaging with encryption, invitations | Port the service layer — it's the exact API the views need |
| `components/Messaging/MessagingPortal.tsx` | Real-time messaging with `onSnapshot`, AES-GCM-256 encryption, read receipts | Port directly — already proven working |
| `components/Admin/UserManagement.tsx` | Invite, revoke, suspend, staff table with roles | Port and extend with new features |
| `services/patientService.ts` | `PatientLookupService` interface with Firestore + mock fallback | Port the Firestore implementation |
| `services/cryptoService.ts` | AES-GCM-256 conversation key generation, encrypt/decrypt | Port as-is — messaging depends on it |
| `functions/src/index.ts` | Cloud Functions: audit log, notifications, email triggers | Port and adapt email to Trigger Email extension |

**The play:** Don't rewrite what already works. Port the old service layer into the rebuild, wire the prototype views to it, and verify each feature.

---

## Pre-Flight (You do these before starting Block 1)

| # | Task | Done? |
|---|------|-------|
| P1 | Firebase project on Blaze plan, Auth + Firestore + Functions + Hosting enabled | ☐ |
| P2 | `.env` with `VITE_FIREBASE_*` config values | ☐ |
| P3 | Firebase CLI installed, `firebase login`, `firebase init` (Firestore, Functions, Hosting) | ☐ |
| P4 | **Install "Trigger Email from Firestore" extension** in Firebase Console. Configure SMTP for `notifications@harmonyhca.org`. Test by manually adding a doc to the `mail` collection in Console and confirming an email arrives. | ☐ |
| P5 | SMTP credentials for `notifications@harmonyhca.org` (host, port, user, password/app password) ready | ☐ |

---

## Block 1: Firebase Init + Auth (Replace Mock Login)

**Sessions:** 1–2  
**Depends on:** Pre-flight complete

**What gets built:**

1. **`src/services/firebase.ts`** — Port from old codebase. Initialize Firebase app, export `auth`, `db`, `functions`.

2. **`src/services/authService.ts`** — Wrap Firebase Auth:
   - `signIn(email, password)` → `signInWithEmailAndPassword`
   - `signOutUser()` → `signOut`
   - `onAuthChange(callback)` → `onAuthStateChanged`

3. **Modify `App.tsx`:**
   - Replace `useState<Staff | null>` login gate with `onAuthStateChanged` listener
   - On auth, fetch staff profile from Firestore `staff/{uid}` for role/displayName
   - Quick-select buttons: gate behind `import.meta.env.DEV`, rewire to call `signInWithEmailAndPassword` with test credentials

4. **`scripts/seed.mjs`** — Port from old codebase. Creates Auth accounts for the 5 test staff, seeds all Firestore collections (staff, patients, dme_catalog, requests, communications, notifications) from mock data. Idempotent. Prints test credentials.

5. **`firestore.rules`** — Port from old codebase. RBAC for all collections. `audit_log` append-only.

**Verify:**
- [ ] `node scripts/seed.mjs` runs clean, Firebase Console shows 5 auth accounts + all collections populated
- [ ] `firebase deploy --only firestore:rules` succeeds
- [ ] Click "Login as Admin" (dev mode) → Firebase Auth Console shows sign-in
- [ ] Refresh page → stays logged in
- [ ] Logout → returns to login screen
- [ ] Invalid credentials → error message displayed
- [ ] Login screen visually identical to Phase 1

---

## Block 2: Wire All Views to Firestore (The Unmocking)

**Sessions:** 2–3  
**Depends on:** Block 1

**What gets built:**

Port `firebaseService.ts` from the old codebase into the rebuild. This file already has every Firestore read/write the views need. Then rewire each view from mock arrays to `firebaseService` calls.

**Wiring order:**

| # | View | Mock → Firestore Change | Verify |
|---|------|------------------------|--------|
| 1 | **DashboardView** | `REQUESTS` array → `firebaseService.subscribeToAllRequests` (admin) / `subscribeToUserRequests` (staff) | Dashboard stats match seeded data |
| 2 | **PatientsView / PatientDetailView** | `PATIENTS` array → `patientService.search()` / `patientService.getById()` | Patient cards render, search works |
| 3 | **RequestListView / RequestDetailView** | `REQUESTS` array → `firebaseService` subscription with status/type filtering | Filter pills work, detail shows all fields |
| 4 | **NewRequestView** (all 3 form types) | `setRequests` push → `firebaseService.submitRequest()` | Submit DME request → appears in Firestore → shows in request list without refresh |
| 5 | **AdminInbox** | Mock approve/deny → `firebaseService.updateRequestStatus()` | Admin approves → status changes → submitter's view updates |
| 6 | **NotificationBell** | `NOTIFICATIONS` array → `firebaseService.subscribeToNotifications()` | Bell badge shows correct unread count from Firestore |
| 7 | **SettingsView** | Non-functional save → `firebaseService.updateStaff()` | Change display name → refresh → persists |

**Drug Database swap (RxNorm API):**
- Replace the local `DRUG_DB` array with a call to the RxNorm API (`https://rxnav.nlm.nih.gov/REST/drugs.json?name=...`)
- Add debounced search (300ms) so we don't hammer the API on every keystroke
- **Manual entry fallback:** If the API returns no results or is unreachable, show a "Type custom medication" option that lets the user enter a drug name manually without an RxCUI
- The ICD-10 lookup already uses NIH Clinical Tables API — same pattern

**What stays the same:** All JSX, inline styles, design tokens, hover states, and visual behavior are untouched. Only the data source changes.

**Verify:**
- [ ] Every view renders identically to Phase 1 but with Firestore data
- [ ] Edit a Firestore document in Console → view updates in real-time (no refresh)
- [ ] Submit a request → document appears in Firestore within 1 second
- [ ] Drug search returns RxNorm results; typing a non-matching name shows manual entry option
- [ ] `grep -r "MOCK_" src/` returns zero results (mock data fully removed from production code, moved to `test/`)

---

## Block 3: Messaging — Port, Connect, Verify

**Sessions:** 1  
**Depends on:** Block 2

**What gets built:**

Port the old codebase's messaging infrastructure into the rebuild:

1. **`services/cryptoService.ts`** — AES-GCM-256 key generation, encrypt, decrypt. Port as-is.
2. **`MessagingPortal.tsx`** — Port the old Firebase-connected version. It already uses `firebaseService.subscribeToMessagesBetween`, `sendMessage`, `markMessageRead` with real-time `onSnapshot` subscriptions and encryption.
3. **Conversation key management** — `conversationKeys/{id}` collection in Firestore stores per-conversation AES keys. Security Rules restrict access to the two participants.

**What's already working in the old code:**
- Real-time delivery via `onSnapshot` (no polling)
- AES-GCM-256 encryption before Firestore write, decryption on read
- Read receipts (mark as `read: true` when recipient opens thread)
- Contact list from `firebaseService.getAllStaff()`
- Skeleton loading states

**What needs verification (not rewriting):**
- Send a message as User A → appears in User B's thread within 2 seconds
- Messages persist across refresh
- Read receipt updates when recipient views the thread
- Only participants + admin can read conversations (Security Rules)
- "END-TO-END ENCRYPTED" badge is now truthful (TLS in transit, AES-256 at rest, AES-GCM-256 application-layer, Security Rules for access control)

**Verify:**
- [ ] Open two browser sessions (different users). Send message from A → appears in B's thread live
- [ ] Refresh B's browser → messages still there
- [ ] B opens the conversation → A sees read receipt update
- [ ] Firebase Console → `communications` collection shows encrypted `messageBody` (not plaintext)
- [ ] Unauthenticated Firestore read on `communications` fails (Rules playground)

---

## Block 4: Document History on Request Detail

**Sessions:** 1  
**Depends on:** Block 2

**What gets built:**

A "History" section on the Request Detail page showing a chronological timeline of every action taken on that request.

**Data model — `history` array embedded in each request document:**

```typescript
interface HistoryEntry {
  action: 'created' | 'approved' | 'denied' | 'rmi' | 'updated' | 'escalated';
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  timestamp: number;
  notes?: string;           // admin notes, RMI reason, etc.
  previousStatus?: string;  // what it was before
  newStatus?: string;       // what it changed to
}
```

**Where history entries get written:**
- `firebaseService.submitRequest()` → adds initial `history: [{ action: 'created', ... }]`
- `firebaseService.updateRequestStatus()` → appends to `history` array using Firestore `arrayUnion`
- Cloud Function `onRequestUpdated` can also append (server-side confirmation)

**UI — added to RequestDetailView:**
- Section below the existing request info, titled "Document History"
- Vertical timeline: colored dot per action type, actor name, timestamp, notes
- Most recent action at top
- Color coding: green (approved), red (denied), amber (RMI), blue (created/updated)

**Verify:**
- [ ] Submit a new request → history shows "Created by [name] on [date]"
- [ ] Admin approves → history shows "Approved by [admin] on [date]" with notes
- [ ] Admin RMIs → history shows "More info requested by [admin]" with reason
- [ ] Timeline displays in correct chronological order
- [ ] History persists across page refresh

---

## Block 5: Team Management — Full Feature Set

**Sessions:** 2  
**Depends on:** Block 1

**What gets built:**

Port `UserManagement.tsx` from the old codebase and extend it with the additional management features.

**Features already in old code (port and verify):**

| Feature | Implementation | Verify |
|---------|---------------|--------|
| **View staff list** | Real-time from `staff` collection | Staff cards render with roles, onboarding status |
| **Invite staff** | Creates Auth account + Firestore staff doc + invitation record + password-reset email | Invitee receives email, sets password, logs in, sees correct role |
| **Revoke invitation** | Sets invitation `status: 'expired'` | Invitation disappears from pending list |
| **Suspend staff** | Sets `status: 'suspended'` on staff doc (soft delete) | Suspended user can no longer log in, records preserved |
| **Self-removal protection** | Cannot delete your own account | Error message when attempting |

**New features to add:**

| Feature | Implementation | Verify |
|---------|---------------|--------|
| **Edit role after creation** | Admin selects new role from dropdown on staff row → `firebaseService.updateStaff(uid, { role: newRole })` | Changed role reflected immediately; user sees updated UI on next login |
| **Reset user's password** | Admin clicks "Reset Password" → `sendPasswordResetEmail(auth, email)` → user receives Firebase password-reset email | Email arrives, user can set new password |
| **View login history** | Each login writes to a `loginHistory` subcollection on the staff doc: `{ timestamp, ip (if available), userAgent }`. Add a collapsible "Login History" section per staff member showing last 10 logins. | Admin sees timestamped login entries for each staff member |

**Login history tracking — where the write happens:**
- In `App.tsx` (or `authService.ts`), after a successful `onAuthStateChanged` fires with a user, write a login event to `staff/{uid}/loginHistory/{auto-id}` with `timestamp: Date.now()`. This is lightweight (one write per login) and doesn't slow anything down.

**Verify (end-to-end, two browser sessions):**
- [ ] Admin invites `newuser@harmonyhca.org` with role "nurse"
- [ ] `newuser@harmonyhca.org` receives password-reset email, sets password
- [ ] New user logs in → sees nurse-role UI, completes onboarding
- [ ] Admin sees new user in staff list with "Setup Pending" then "Onboarded" status
- [ ] Admin changes new user's role to "office_staff" → user's UI updates on next login
- [ ] Admin clicks "Reset Password" for the user → user receives another password-reset email
- [ ] Admin views the user's login history → sees timestamped entries
- [ ] Admin suspends the user → user gets kicked out / can no longer log in
- [ ] Admin revokes a pending invitation → invitation disappears from list

---

## Block 6: Email Notifications via Trigger Email Extension

**Sessions:** 1  
**Depends on:** Blocks 2, 4 (requests and history must be flowing through Firestore)

**What gets built:**

Cloud Functions that write to the `mail` collection when events happen. The Firebase Trigger Email extension picks up the doc and sends via `notifications@harmonyhca.org`.

**Email triggers:**

| Event | Cloud Function Trigger | `mail` Document Written |
|-------|----------------------|------------------------|
| New request submitted | `onDocumentCreated('requests/{id}')` | `to`: all admin emails, `subject`: "New [type] request from [submitter]", `html`: brief summary + "Log in to review" |
| Request approved | `onDocumentUpdated('requests/{id}')` where status changed to `approved` | `to`: submitter email, `subject`: "[Type] request approved", `html`: admin notes + "Log in for details" |
| Request denied | Same trigger, status → `denied` | `to`: submitter email, `subject`: "[Type] request denied", `html`: admin notes |
| Request RMI | Same trigger, status → `rmi` | `to`: submitter email, `subject`: "More info needed on your [type] request", `html`: admin notes |
| New message | `onDocumentCreated('communications/{id}')` | `to`: recipient email, `subject`: "New message from [sender]", `html`: "Log in to read" (no message content) |

**The `mail` document format** (required by the Trigger Email extension):

```typescript
await db.collection('mail').add({
  to: recipientEmail,
  message: {
    subject: 'New DME request from Maria Santos',
    html: '<p>A new DME request has been submitted for patient Margaret Thornton.</p><p><a href="https://your-domain.com">Log in to review</a></p><p style="color:#999;font-size:11px;">Do not reply to this email. Use the portal for all communication.</p>',
  },
});
```

**What does NOT go in emails:** No medication names, no ICD-10 codes, no message content, no clinical data. Just names, request type, action taken, and "log in for details."

**Adapting the old Cloud Functions:**
The old `functions/src/index.ts` used SendGrid (`@sendgrid/mail`). Replace every `sgMail.send()` call with a Firestore write to the `mail` collection. The trigger logic (which events fire which emails) stays the same. Delete the SendGrid dependency.

**Verify:**
- [ ] Nurse submits a request → Admin receives email from `notifications@harmonyhca.org` within 60 seconds
- [ ] Admin approves → Nurse receives "approved" email
- [ ] Admin denies → Nurse receives "denied" email
- [ ] Admin RMIs → Nurse receives "more info needed" email
- [ ] User A sends a message → User B receives "new message" email
- [ ] No email contains clinical data (spot-check email content)
- [ ] Firebase Console → `mail` collection shows documents with `delivery.state: 'SUCCESS'`

---

## Block Dependency Graph

```
Pre-flight (P1–P5)
       │
       ▼
    Block 1: Firebase Init + Auth + Seed + Rules
       │
       ├──────────┬──────────┐
       ▼          ▼          ▼
    Block 2:   Block 3:   Block 5:
    Wire Views Messaging  Team Mgmt
       │          
       ├──────────┐
       ▼          ▼
    Block 4:   Block 6:
    Doc History Email Triggers
```

Blocks 3 and 5 can run in parallel with Block 2 since they only depend on Block 1.  
Block 4 and 6 depend on Block 2 (requests must be flowing through Firestore).

---

## Estimated Effort

| Block | Sessions | What |
|-------|----------|------|
| Pre-flight | 1 | Firebase project setup, extension install, SMTP config |
| Block 1 | 1–2 | Auth + seed + rules |
| Block 2 | 2–3 | View wiring + RxNorm swap (largest block) |
| Block 3 | 1 | Messaging port + verify |
| Block 4 | 1 | Document history UI + data model |
| Block 5 | 2 | Team management full feature set |
| Block 6 | 1 | Email triggers via extension |
| **Total** | **~9–11 sessions** | |

---

## Session Start Protocol

Open a Claude Code session. Say:

> "Phase 2, Block [number]. Here's what you need: [paste any files or context it asks for]."

Claude reads the relevant files, builds the deliverable, and provides the verification checklist from this plan. You run the checklist. If it passes, move to the next block.

---

## Phase 2 Is Complete When

1. ✅ Users log in with email/password via Firebase Auth (quick-select in dev only)
2. ✅ All data lives in Firestore — zero mock arrays in production code
3. ✅ Real-time updates work: request list, messages, and notifications update without refresh
4. ✅ Drug search uses RxNorm API with manual entry fallback
5. ✅ Document history shows a chronological timeline on every request
6. ✅ Messaging is encrypted, real-time, and persisted with read receipts
7. ✅ Team management: invite, suspend, edit role, reset password, view login history — all verified
8. ✅ Emails send from `notifications@harmonyhca.org` on request events and new messages
9. ✅ Visual design identical to Phase 1 prototype — no regressions

---

## What Is NOT in Phase 2

| Deferred | Phase |
|----------|-------|
| Session timeout (15-min) | 3 |
| TOTP MFA | 3 |
| Zod server-side validation | 3 |
| E2E tests (Playwright) | 3 |
| Notification preferences UI | 3 |
| FCM push notifications | 3 |
| HIPAA Risk Assessment | 3 |
| BAA | 3 |
| Penetration test | 4 |
| HL7 FHIR patient registry | 4 |
| CMS-1500 form generation | 4 |
| Multi-tenant / white-label | 5+ |
