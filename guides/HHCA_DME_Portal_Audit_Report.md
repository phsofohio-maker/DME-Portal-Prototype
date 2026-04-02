# HHCA DME Portal — Comprehensive Audit Report

**Auditor:** Claude Code (Automated)  
**Date:** April 2, 2026  
**Scope:** UI/UX Feedback · Feature Functionality · Code Logic Cleanup  
**App Status:** Phase 2 Complete, Phase 3 (Verification & Integration) In Progress  
**Methodology:** Every finding below is sourced from reading the actual codebase and running commands — no assumptions.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Total findings** | **42** |
| Critical | 8 |
| High | 9 |
| Medium | 14 |
| Low | 11 |
| Build status | **PASS** (Vite), **FAIL** (tsc --noEmit: 8 errors) |
| TypeScript errors | 8 (all `import.meta.env` — missing `vite-env.d.ts`) |
| npm audit (client) | 4 vulnerabilities (3 moderate, 1 high) |
| npm audit (functions) | 14 vulnerabilities (9 low, 1 moderate, 4 high) |
| Total LOC | 9,093 |
| Bundle size | 1,214 KB (exceeds 800 KB warning by 52%) |

**Overall assessment:** The portal is architecturally sound with strong security fundamentals (Firestore RBAC, AES-GCM-256 messaging, append-only audit log, server-side invitation flow). Core features — auth, request lifecycle, encrypted messaging, admin workflows, PDF export — are wired end-to-end. The main gaps are: accessibility (zero ARIA/keyboard support), performance optimization (no memoization, no code splitting, oversized bundle), missing `vite-env.d.ts`, and a handful of error handling inconsistencies.

---

## Session 0: Ground Truth

### Project Structure

Actual file structure matches README with these **discrepancies**:

| README Claims | Actual | Severity |
|---------------|--------|----------|
| `src/lib/schemas.ts` (client Zod schemas) | **Does not exist** | HIGH — no client-side Zod validation schemas |
| `functions/src/schemas.ts` (server Zod schemas) | **Does not exist** | HIGH — no server-side Zod validation schemas |
| `src/services/pdfService.ts` | Actually `src/utils/pdfExport.ts` | LOW |
| `src/components/Forms/ICD10Field.tsx` | Actually `src/components/Icd10Search.tsx` | LOW |
| `src/views/AdminInbox.tsx` | Actually `src/views/RequestListView.tsx` | LOW |
| `src/components/Forms/` directory | **Does not exist** — forms are inline in `NewRequestView.tsx` | MEDIUM |
| Vite 6 | Vite 5.4 (`"vite": "^5.4.0"`) | LOW |
| Logger has "6 levels, HIPAA-safe audit" | Logger has 3 levels (info, warn, error), no PHI sanitization | MEDIUM |
| `Request.details` uses `kind` discriminator | Actually uses `type` discriminator | LOW |

### Build Status

- **Vite build:** PASS (15.77s, 477 modules)
- **Functions build:** PASS (clean)
- **`tsc --noEmit`:** FAIL — 8 errors, all identical: `Property 'env' does not exist on type 'ImportMeta'`
  - **Root cause:** Missing `src/vite-env.d.ts` file with `/// <reference types="vite/client" />`
  - **Affected files:** `src/services/firebase.ts` (6 errors), `src/services/logger.ts` (1), `src/views/LoginScreen.tsx` (1)
  - **Severity:** HIGH — blocks strict TypeScript CI checks

### npm Audit

**Client (4 vulnerabilities):**
- brace-expansion <1.1.13 (moderate) — fixable
- esbuild ≤0.24.2 (moderate) — requires Vite 6 upgrade
- picomatch 4.0.0-4.0.3 (high) — fixable

**Functions (14 vulnerabilities):**
- lodash ≤4.17.23 (high) — fixable
- node-forge ≤1.3.3 (high) — fixable
- path-to-regexp <0.1.13 (high) — fixable
- picomatch (high) — fixable
- @tootallnate/once (low) — deep dependency chain

---

## Audit 1: UI for System & User Feedback

### Block 1.1: Loading States

| View | Has Loading State | Type | Blank Screen Risk | Notes |
|------|:-:|------|:-:|-------|
| DashboardView | N/A | Data via props | No | Pure display; no async fetch |
| RequestListView | No | — | No | Data via props |
| MessagesView | No | — | **Yes** | No spinner while subscription loads; shows EmptyState |
| PatientsView | No | — | No | Static mock data |
| TeamView | Partial | Button text "…" | No | During save actions only |
| PatientDetailView | No | — | No | Data via props |
| RequestDetailView | Yes | Button text ("Approving…") | No | Action loading only |
| SettingsView | Yes | Button text ("Saving…") | No | |
| LoginScreen | Yes | Button text + SVG spinner | No | Best-in-class |
| NewRequestView | Yes | Button text + inline spinners | No | DrugSearch/Icd10Search have spinners |
| App.tsx (auth) | Yes | Full-screen spinner | No | AuthLoading component |

**Finding F-1.1:** No view uses **skeleton loading**. All loading indicators are button text changes or spinners. For data-fetch views (Dashboard, RequestList, Patients), data arrives via props from App.tsx subscriptions — there is no loading state during initial subscription hydration. **Severity: MEDIUM**

### Block 1.2: Error Feedback

| Location | Error Type | User Sees | Severity |
|----------|-----------|-----------|----------|
| LoginScreen | Auth errors | Friendly messages (invalid creds, rate limit, generic) | OK |
| NewRequestView (3 forms) | Submit failure | "Failed to submit request. Please try again." | OK |
| NewRequestView | Validation | Inline field errors via local state | OK |
| MessagesView | Send failure | "Failed to send. Please try again." | OK |
| TeamView | Invite failure | Specific error message | OK |
| SettingsView | Save failure | "Failed to save changes." | OK |
| RequestDetailView | Action failure | "Failed to update request." | OK |
| DrugSearch | API failure | Silent — shows "no results" | MEDIUM |
| Icd10Search | API failure | Silent — shows empty dropdown | MEDIUM |

**Finding F-1.2a:** No `alert()` calls found anywhere. **Severity: OK**

**Finding F-1.2b:** No React ErrorBoundary component exists. An unhandled render error will show the React error overlay in dev or a white screen in production. **Severity: HIGH**

**Finding F-1.2c:** DrugSearch and Icd10Search silently swallow API errors — user sees "no results" instead of an error message indicating the external API failed. **Severity: MEDIUM**

### Block 1.3: Success Confirmation

| Action | Confirmation | Type | Severity |
|--------|:------------:|------|----------|
| Request submission | Yes | ConfirmationScreen with checkmark + "submitted and pending review" | OK |
| Settings save | Yes | "Changes saved" with checkmark, auto-dismiss 2.5s | OK (best-in-class) |
| Team invite | Yes | "Invitation sent to {email}" banner | OK |
| Admin approve/deny/RMI | No | Navigates back silently | MEDIUM |
| Message send | No | Input clears; message appears in thread | LOW |
| Staff role change | No | Silent | MEDIUM |
| Staff suspend/reactivate | No | Silent | MEDIUM |

**Finding F-1.3:** Admin actions (approve/deny/RMI, role change, suspend) complete without explicit success feedback. User must infer success from UI state changes. **Severity: MEDIUM**

### Block 1.4: Empty States

| View | Empty State | CTA | Filtered-to-Zero | Notes |
|------|:-----------:|:---:|:-----------------:|-------|
| DashboardView | Partial | Via RequestRows | N/A | |
| RequestListView | Yes | "No requests yet" / "No matching requests" | Yes | Differentiates |
| PatientsView | Yes | "No patients found" | Yes | |
| MessagesView | Yes | EmptyState component | Yes | |
| TeamView | No | — | N/A | Staff list renders even if empty |
| TopBar (notifs) | Yes | "No notifications" | N/A | |

**Finding F-1.4:** EmptyState component exists and is used in most list views. TeamView has no empty state for staff list. **Severity: LOW**

### Block 1.5: Notification System

| Feature | Status | Notes |
|---------|--------|-------|
| Bell icon with unread count | Implemented | TopBar.tsx — badge shows count of unread |
| Click notification → navigate | Implemented | resourceId used for navigation |
| Mark individual as read | Implemented | firebaseService.markNotificationRead |
| Mark all read | Implemented | firebaseService.markAllNotificationsRead |
| Close dropdown on outside click | Implemented | useEffect with document mousedown listener |
| Notification preferences | Implemented | emailOnStatusChange, emailOnNewMessage respected by Cloud Functions |
| Empty state in dropdown | Implemented | "No notifications" text |

**Finding F-1.5:** Notification system is fully wired. **Severity: OK**

### Block 1.6: Connection & Offline Status

**Finding F-1.6:** No connection status indicator, no offline detection, no `navigator.onLine` check, no Firestore persistence configuration (`enablePersistence`/`enableMultiTabIndexedDbPersistence`), no sync indicator. **Severity: MEDIUM** — acceptable for prototype phase, but required for HIPAA deployment.

---

## Audit 2: Feature Functionality Verification

### Block 2.1: Authentication & Session Management

| Feature | Status | Evidence |
|---------|--------|----------|
| Email/password login | **Implemented** | `signInWithEmailAndPassword` in authService.ts, LoginScreen.tsx |
| Session timeout (≤15 min HIPAA) | **UI-ONLY** | SettingsView shows "Session Timeout" card with "Configure" button — no actual idle tracking or timeout logic | 
| Logout clears all state | **Implemented** | App.tsx:146-154 clears user, navigation, selections, notifications |
| Suspended user guard | **Implemented** | App.tsx:62-65 checks `profile.status === "suspended"`, signs out, shows error |
| Dev quick-select | **Implemented** | LoginScreen gated by `import.meta.env.DEV` |
| MFA enrollment | **NOT IMPLEMENTED** | SettingsView:181-190 shows placeholder UI only |
| Audit logging (login/logout) | **Implemented** | Cloud Function `logAuthEvent` writes to audit_log; firebaseService calls it on login/logout |

**Finding F-2.1a:** No HIPAA session timeout. No idle/inactivity detection. **Severity: CRITICAL** — HIPAA §164.312(a)(2)(iii) requires automatic logoff.

**Finding F-2.1b:** MFA is placeholder only. **Severity: HIGH** — HIPAA recommends MFA for administrative access.

### Block 2.2: Request Lifecycle

| Step | Status | Evidence |
|------|--------|----------|
| DME form → patient select → equipment → ICD-10 → submit | **Implemented** | NewRequestView DmeForm (lines ~230-430) |
| Medication form → patient → drug search → dosage → submit | **Implemented** | NewRequestView MedicationForm (lines ~440-680) |
| Multi-medication form → add/remove drugs → submit | **Implemented** | NewRequestView MultiMedForm (lines ~690-1050) |
| Client-side Zod validation | **NOT IMPLEMENTED** | `src/lib/schemas.ts` does not exist. Forms use local state validation (required field checks), not Zod |
| Server-side Zod validation in Cloud Functions | **NOT IMPLEMENTED** | `functions/src/schemas.ts` does not exist. Cloud Functions accept any shape |
| Request appears in submitter dashboard | **Implemented** | subscribeToUserRequests (non-admin), subscribeToAllRequests (admin) |
| Admin can approve/deny/RMI | **Implemented** | RequestDetailView:111-137, firebaseService.updateRequestStatus |
| Status change → audit log entry | **Implemented** | History entries appended via arrayUnion |
| Status change → email notification | **Implemented** | Cloud Function onRequestStatusChange |
| Request detail → full history timeline | **Implemented** | RequestDetailView renders history entries with timestamps |

**Finding F-2.2:** Zod validation is referenced in README and project plans but **does not exist**. Neither `src/lib/schemas.ts` nor `functions/src/schemas.ts` exist. Forms rely on manual required-field checks. Cloud Functions accept any payload shape. **Severity: CRITICAL** — data integrity gap at both boundaries.

### Block 2.3: Patient Registry

| Feature | Status | Notes |
|---------|--------|-------|
| Patient list with search | **Implemented** | PatientsView with name/MRN filter |
| Patient detail (demographics, allergies, conditions) | **Implemented** | PatientDetailView |
| "New Request" from patient detail | **Implemented** | Pre-selects patient |
| Data source | **MOCK_PATIENTS** | App.tsx imports from `data/patients.ts`. `patientService.ts` has Firestore composite fallback but App.tsx uses static import |

**Finding F-2.3:** Patient data is static mock data in the bundle. The `patientService.ts` abstraction with Firestore-first + mock fallback exists but is **not wired to App.tsx** — App.tsx directly imports `MOCK_PATIENTS`. **Severity: MEDIUM** — documented as intentional for Phase 3, but the Firestore service is unused dead code until wired.

### Block 2.4: Messaging Portal

| Feature | Status | Notes |
|---------|--------|-------|
| Thread list with last message, unread badge | **Implemented** | MessagesView |
| Compose new message | **Implemented** | ComposeForm with recipient select |
| Real-time delivery | **Implemented** | subscribeToMessagesBetween with onSnapshot |
| Read receipts | **Implemented** | markMessageRead on conversation open |
| AES-GCM-256 encryption | **Implemented** | cryptoService.ts: generateConversationKey, encryptMessage, decryptMessage |
| Per-conversation keys | **Implemented** | Stored in `conversationKeys` collection with participant-only access |
| Ephemeral messages | **PARTIALLY IMPLEMENTED** | `ephemeral` flag stored on messages; `cleanupEphemeralMessages` Cloud Function runs daily at midnight ET |

**Finding F-2.4:** Messaging encryption is fully implemented with AES-GCM-256 via Web Crypto API. Ephemeral message cleanup exists as a scheduled Cloud Function (`cleanupEphemeralMessages`). The UI has no toggle for ephemeral mode visible, but the plumbing is complete. **Severity: OK**

### Block 2.5: Admin Workflow

| Feature | Status | Notes |
|---------|--------|-------|
| Admin inbox (all pending requests) | **Implemented** | Admin sees all requests via subscribeToAllRequests |
| Approve/Deny/RMI with notes | **Implemented** | RequestDetailView with notes textarea |
| Bulk actions | **Not implemented** | Single-request actions only |
| Escalation/reassignment | **Not implemented** | No assign-to-admin feature |
| Team management (invite, suspend, reactivate, role change) | **Implemented** | TeamView |
| Admin self-protection | **Implemented** | `isSelf` check prevents role change and suspension of own account |
| Invitation flow | **Implemented** | Email → role → Cloud Function creates Auth account + sends branded email |

**Finding F-2.5:** Core admin workflow is complete. Bulk actions and escalation are not implemented (Phase 4 features). **Severity: OK for current phase**

### Block 2.6: PDF Export

| Feature | Status | Notes |
|---------|--------|-------|
| Export button on request detail | **Implemented** | RequestDetailView "Export PDF" button |
| PDF includes request details | **Implemented** | Type-specific rendering for DME, medication, multi-med |
| PDF includes patient info | **Implemented** | Patient name, DOB, MRN |
| PDF includes timestamps/status | **Implemented** | Created, processed dates + status badge |
| QR code | **Not implemented** | |
| CMS-1500 pre-population | **Not implemented** | |

**Finding F-2.6a:** PDF export is functional for all 3 request types. **Severity: OK**

**Finding F-2.6b:** pdfExport.ts has **no error handling** — if jsPDF fails, the error is uncaught. **Severity: MEDIUM**

### Block 2.7: Help & Settings

| Feature | Status | Notes |
|---------|--------|-------|
| FAQ accordion (6 topics) | **Implemented** | HelpView with expand/collapse |
| Settings: display name | **Implemented** | Persists to Firestore |
| Settings: email change | **UI-ONLY** | Field visible but not saved |
| Settings: password change | **UI-ONLY** | Fields visible, disclaimer shown |
| Settings: 2FA toggle | **UI-ONLY** | Placeholder |
| Settings: notification prefs | **Implemented** | emailOnStatusChange, emailOnNewMessage toggles wired to Firestore |
| Settings: session timeout | **UI-ONLY** | Placeholder |

**Finding F-2.7:** Settings page includes clear disclaimer: "Password and email changes are not yet functional. Security features are coming in a future update." **Severity: OK — properly communicated**

---

## Audit 3: Code Logic Cleanup

### Block 3.1: Dead Code & Legacy Artifacts

| Check | Result | Severity |
|-------|--------|----------|
| `sourceCode.ts` prototype artifact | **Not found** — already cleaned up | OK |
| `Staff.pin` field references | **None found** — already cleaned up | OK |
| `MOCK_PATIENTS` usage | Used in `mockData.ts` → `patientService.ts` (intentional fallback) | OK (documented) |
| `localStorage`/`sessionStorage` | **None found** | OK |
| CDN Tailwind | **None found** | OK |
| Unused imports (`tsc --noEmit`) | Not detectable (8 `import.meta.env` errors mask other warnings) | BLOCKED |
| Unreachable code | Not detectable (same reason) | BLOCKED |
| Orphan files (zero imports) | **`src/data/drugDb.ts`** — imported nowhere | LOW |

**Finding F-3.1a:** `src/data/drugDb.ts` is an orphan file (16 hardcoded drugs). The app uses the NIH RxNorm API via DrugSearch instead. **Severity: LOW**

**Finding F-3.1b:** `src/data/messages.ts` and `src/data/notifications.ts` are imported nowhere — they contain mock data that was replaced by Firestore subscriptions. **Severity: LOW** — dead code, safe to remove.

**Finding F-3.1c:** `src/data/requests.ts` is imported in App.tsx as initial state before Firestore subscription fires. **Severity: OK** — intentional fallback.

### Block 3.2: Type Safety Gaps

| Pattern | Count | Severity | Details |
|---------|:-----:|----------|---------|
| `as any` | 2 | MEDIUM | `pdfExport.ts:41,43` — jsPDF GState workaround |
| `as Type` assertions | 20 | LOW-MEDIUM | Mostly Firestore `DocumentData` → typed entity casts (expected pattern) |
| Non-null assertions (`!`) | 0 | OK | None found |
| `details: any` in types | 0 | OK | Proper discriminated union |

**Finding F-3.2a:** The 2 `as any` usages in pdfExport.ts are a jsPDF API workaround for GState opacity. Low risk, contained. **Severity: MEDIUM**

**Finding F-3.2b:** The `as Type` assertions in firebaseService.ts (toStaff, toRequest, toComm, toInvite) are the standard Firestore pattern. Without server-side Zod validation (Finding F-2.2), these assertions are the only type enforcement on data read from Firestore — they trust the stored data shape. **Severity: MEDIUM**

### Block 3.3: Error Handling Integrity

| Pattern | Count | Severity |
|---------|:-----:|----------|
| Empty catch block (swallowed error) | **1** | CRITICAL |
| `console.error/warn` bypassing logger | **4** | HIGH |
| Catch with user feedback but no diagnostic logging | **6** | MEDIUM |
| Catch with both user feedback and logging | **3** | OK |
| ErrorBoundary components | **0** | HIGH |
| `alert()` calls | **0** | OK |
| `throw new Error` | **1** | OK (retryWithBackoff re-throw) |

**Finding F-3.3a:** Empty catch block in `firebaseService.ts:117`: logout audit log call fails silently. **Severity: CRITICAL** — compliance gap (failed audit log write should at minimum be logged).

**Finding F-3.3b:** Structured logger (`src/services/logger.ts`) exists but is **never used** in application code. All error handling uses raw `console.error` (3 locations) or `console.warn` (1 location). **Severity: HIGH**

**Finding F-3.3c:** Logger gates `info` and `warn` with `isDev` — only `error` logs in production. This is by design but means production has zero diagnostic logging below error level. **Severity: MEDIUM**

**Finding F-3.3d:** No React ErrorBoundary in the component tree. An unhandled render error will white-screen in production. **Severity: HIGH**

### Block 3.4: Security Surface

| Check | Result | Severity |
|-------|--------|----------|
| Firestore rules: all collections covered | **Yes** — 11 match blocks for 11 collections | OK |
| Deny-all default | **Yes** — no wildcard match | OK |
| Audit log append-only | **Yes** — all client ops `false`, admin read only | OK |
| Hardcoded secrets | **None found** | OK |
| XSS (`dangerouslySetInnerHTML`) | **None** in React code | OK |
| HTML injection in emails | `adminNotes` interpolated unsanitized into email HTML (`functions/src/index.ts:169`) | MEDIUM |
| Environment variables | Firebase config via `import.meta.env.VITE_*` (proper) | OK |
| CORS | No explicit CORS config needed (Firebase SDK + Hosting) | OK |

**Finding F-3.4:** `adminNotes` is interpolated directly into HTML email templates without escaping. An admin could inject HTML via the notes field. **Severity: MEDIUM** — internal-only users mitigate risk, but should sanitize.

### Block 3.5: Performance & Bundle

| Check | Result | Severity |
|-------|--------|----------|
| Bundle size | **1,214 KB** main chunk (800 KB threshold) | CRITICAL |
| Large components (>500 lines) | 3: NewRequestView (1,094), RequestDetailView (620), MessagesView (538) | HIGH |
| React.memo / useMemo / useCallback usage | **Zero** across entire codebase | HIGH |
| Firestore subscription cleanup | Proper — all useEffect returns have unsubscribe | OK |
| React.lazy / code splitting | **None** | MEDIUM |
| N+1 query patterns | None detected — uses collection queries | OK |

**Finding F-3.5a:** Main bundle at 1,214 KB is 52% over the 800 KB warning. `html2canvas` (201 KB) is loaded even when PDF export is not used. **Severity: CRITICAL**

**Finding F-3.5b:** `NewRequestView.tsx` at 1,094 lines contains 3 complete form components inline. Should be split into separate files. **Severity: HIGH**

**Finding F-3.5c:** No memoization anywhere. Every Firestore subscription update triggers re-renders through the entire component tree. **Severity: HIGH**

### Block 3.6: Accessibility

| Check | Count | Severity |
|-------|:-----:|----------|
| `aria-label` / `aria-describedby` / `aria-labelledby` | **0** | CRITICAL |
| `role=` attributes | **0** | CRITICAL |
| `onKeyDown` / `onKeyUp` / keyboard handlers | **0** | CRITICAL |
| `tabIndex` on custom interactive elements | **0** | CRITICAL |
| Focus management (`autoFocus`, `FocusTrap`) | **0** | CRITICAL |
| `alt` text on images/icons | **0** | HIGH |

**Finding F-3.6:** The application has **zero accessibility support**. No ARIA attributes, no keyboard navigation, no focus management, no screen reader support. Every interactive Card, Icon button, and custom control is inaccessible to assistive technology users. **Severity: CRITICAL** — WCAG 2.1 Level A failure across the board.

### Block 3.7: Consistency & Conventions

| Check | Result | Severity |
|-------|--------|----------|
| Styling approach | 462 `style={{}}` with design tokens (T.*) — consistent, matches spec | OK |
| Tailwind class usage | **0** — correctly avoided per spec | OK |
| Component naming (PascalCase) | 17/17 compliant | OK |
| Utility naming (camelCase) | 4/4 compliant | OK |
| TODO/FIXME/HACK comments | **0** found | OK |

**Finding F-3.7:** Code conventions are consistently followed. No violations detected. **Severity: OK**

---

## Findings by Severity

### CRITICAL (8)

| ID | Category | Finding | Location |
|----|----------|---------|----------|
| C-1 | Accessibility | Zero ARIA attributes, keyboard handlers, focus management | All of `src/` |
| C-2 | Feature | No HIPAA session timeout (≤15 min idle auto-logoff) | App.tsx — not implemented |
| C-3 | Feature | Zod validation schemas do not exist (client or server) | `src/lib/schemas.ts` and `functions/src/schemas.ts` missing |
| C-4 | Performance | Main bundle 1,214 KB (52% over 800 KB threshold) | Build output |
| C-5 | TypeScript | `tsc --noEmit` fails: 8 errors — missing `vite-env.d.ts` | `src/vite-env.d.ts` missing |
| C-6 | Error Handling | Empty catch block swallows logout audit log failure | `firebaseService.ts:117` |
| C-7 | Error Handling | No React ErrorBoundary — unhandled render error → white screen | App.tsx |
| C-8 | Accessibility | No alt/aria-label on Icon component (used 100+ times) | `Icon.tsx` |

### HIGH (9)

| ID | Category | Finding | Location |
|----|----------|---------|----------|
| H-1 | Feature | MFA not implemented (UI placeholder only) | `SettingsView.tsx:181-190` |
| H-2 | Performance | NewRequestView at 1,094 lines (3 forms inline) | `NewRequestView.tsx` |
| H-3 | Performance | Zero React.memo/useMemo/useCallback usage | All of `src/` |
| H-4 | Error Handling | Structured logger exists but is never called in app code | `logger.ts` unused |
| H-5 | Error Handling | 4 raw `console.error/warn` calls bypass logger | MessagesView (2), TeamView (1), retryWithBackoff (1) |
| H-6 | Documentation | README claims Zod schemas exist — they don't | `README.md` lines 32, 57-58 |
| H-7 | Documentation | README file paths don't match actual structure (6 discrepancies) | `README.md` |
| H-8 | npm audit | 4 high-severity vulnerabilities in functions deps | `functions/package.json` |
| H-9 | Accessibility | Keyboard-only users cannot navigate — no tabIndex/onKeyDown | All interactive components |

### MEDIUM (14)

| ID | Category | Finding | Location |
|----|----------|---------|----------|
| M-1 | UI/UX | No loading skeletons — all views load instantly via props or show no indicator | All views |
| M-2 | UI/UX | Admin approve/deny/RMI navigates back without success confirmation | `RequestDetailView.tsx:131` |
| M-3 | UI/UX | Staff role change and suspend/reactivate have no success feedback | `TeamView.tsx` |
| M-4 | UI/UX | DrugSearch/Icd10Search silently swallow API errors as "no results" | `DrugSearch.tsx`, `Icd10Search.tsx` |
| M-5 | UI/UX | No offline/connection status indicator | Not implemented |
| M-6 | Feature | Patient data uses static import, not the Firestore-backed `patientService` | `App.tsx:199` |
| M-7 | Error Handling | 6 catch blocks show user error but don't log diagnostics | NewRequestView (3), RequestDetailView, SettingsView, LoginScreen |
| M-8 | Error Handling | PDF export has no try/catch — errors uncaught | `pdfExport.ts` |
| M-9 | Error Handling | Logger gates info/warn behind isDev — production has error-only logging | `logger.ts:4-5` |
| M-10 | Security | adminNotes interpolated unsanitized into HTML emails | `functions/src/index.ts:169` |
| M-11 | Type Safety | `as any` in pdfExport.ts for jsPDF GState API | `pdfExport.ts:41,43` |
| M-12 | Type Safety | Firestore data cast to types without runtime validation (no Zod) | `firebaseService.ts:66-69` |
| M-13 | Performance | No code splitting / lazy loading for views | `App.tsx` |
| M-14 | Documentation | README says Forms/ directory exists — forms are inline in NewRequestView | `README.md` |

### LOW (11)

| ID | Category | Finding | Location |
|----|----------|---------|----------|
| L-1 | Dead Code | `src/data/drugDb.ts` — orphan file, imported nowhere | `drugDb.ts` |
| L-2 | Dead Code | `src/data/messages.ts` — orphan, replaced by Firestore | `messages.ts` |
| L-3 | Dead Code | `src/data/notifications.ts` — orphan, replaced by Firestore | `notifications.ts` |
| L-4 | UI/UX | Message send has no explicit success confirmation (implicit via thread update) | `MessagesView.tsx` |
| L-5 | UI/UX | TeamView has no empty state for staff list | `TeamView.tsx` |
| L-6 | Documentation | README says Vite 6, actual is Vite 5.4 | `package.json` |
| L-7 | Documentation | README says `kind` discriminator, actual is `type` | `types.ts` |
| L-8 | Documentation | README pdfService.ts path doesn't match actual pdfExport.ts | `README.md` |
| L-9 | Documentation | README ICD10Field.tsx path doesn't match actual Icd10Search.tsx | `README.md` |
| L-10 | Documentation | README AdminInbox.tsx doesn't match actual RequestListView.tsx | `README.md` |
| L-11 | npm audit | 4 vulnerabilities in client deps (3 moderate, 1 high) | `package.json` |

---

## Recommended Priority Order

### 1. Critical — Must fix before Phase 3 exit

1. **C-5: Create `src/vite-env.d.ts`** — one line: `/// <reference types="vite/client" />`. Unblocks `tsc --noEmit`.
2. **C-3: Create Zod schemas** — `src/lib/schemas.ts` (client) and `functions/src/schemas.ts` (server). Enforce data integrity at both boundaries.
3. **C-2: Implement HIPAA session timeout** — 15-minute idle auto-logoff with warning modal.
4. **C-6: Fix empty catch** — Add `logger.warn()` to `firebaseService.ts:117` logout audit call.
5. **C-7: Add ErrorBoundary** — Wrap App-level component to catch render crashes.

### 2. High — Should fix before internal deployment

6. **H-4/H-5: Wire structured logger** — Replace all raw `console.*` calls with `logger.*` calls.
7. **H-2: Split NewRequestView** — Extract DmeForm, MedicationForm, MultiMedForm into `src/components/Forms/`.
8. **H-3: Add React.memo** — At minimum on Card, RequestRows, Sidebar, TopBar.
9. **C-4/M-13: Code splitting** — `React.lazy()` for view components; dynamic import for html2canvas.
10. **H-6/H-7: Update README** — Fix all 9 documentation discrepancies.
11. **H-8/L-11: Run `npm audit fix`** — Address fixable vulnerabilities in both packages.

### 3. Medium — Should fix before multi-tenant phase

12. **C-1/C-8/H-9: Accessibility pass** — Add ARIA labels to Icon, keyboard handlers to Card/interactive elements, focus management.
13. **M-2/M-3: Success feedback** — Add toast/banner for admin actions and staff management.
14. **M-10: Sanitize email HTML** — Escape `adminNotes` before template interpolation.
15. **M-6: Wire patientService** — Replace static `MOCK_PATIENTS` import in App.tsx with `patientService.listAll()`.
16. **M-7/M-8: Diagnostic logging** — Add `logger.error()` to all catch blocks; wrap pdfExport in try/catch.

### 4. Low — Polish

17. **L-1/L-2/L-3: Remove dead data files** — `drugDb.ts`, `messages.ts`, `notifications.ts`.
18. **L-4/L-5: Minor UI gaps** — Message send confirmation, TeamView empty state.
19. **H-1: MFA implementation** — Implement TOTP enrollment for admin accounts.
20. **M-5: Offline indicator** — Add connection status banner.

---

## Phase 3 Gate Impact

The following findings **block Phase 3 exit criteria**:

| Finding | Gate Criteria | Blocker? |
|---------|--------------|:--------:|
| C-5: tsc fails | "Build and type check pass" | **YES** |
| C-3: No Zod schemas | "Client + server validation" | **YES** |
| C-2: No session timeout | "HIPAA compliance" | **YES** |
| C-7: No ErrorBoundary | "Production error handling" | **YES** |
| H-6/H-7: Stale README | "Documentation accuracy" | **YES** |
| C-4: Bundle > 800 KB | "Performance baseline" | SOFT YES |
| C-1: No accessibility | "WCAG 2.1 Level A" | Depends on Phase 3 scope |

**Minimum fixes to unblock Phase 3:** C-5, C-3, C-2, C-7, H-6/H-7 (5 items).

---

*Report generated by automated audit on April 2, 2026. All findings are based on codebase analysis — no fixes were applied. Review with IT Lead before remediation begins.*
