HHCA — Harmony Dashboard

**UI Feedback Plan: Sanity Check & Engineering Review**

Prepared for IT Lead  |  April 2, 2026  |  Version 1.0

| Plan Under Review | UI Feedback Implementation Plan v1.2.x |
| :---- | :---- |
| **Plan Date** | April 1, 2026 |
| **Reviewer** | The Architect — Senior Engineering |
| **Status** | BLOCKED — Codebase Mismatch Requires Clarification |
| **Estimated Effort** | \~6 hours (per plan) — contingent on resolution of Finding F-01 |

# **Executive Summary**

This review assessed the UI Feedback Implementation Plan (v1.2.x) against the live HHCA project repository. The plan is well-structured internally — its dependency ordering, fix prioritization, and scope discipline are sound engineering. However, a critical architectural mismatch was identified that must be resolved before any code is written.

The plan targets a JSX/CSS-class-based application with a theme.css variable system. The HHCA DME Portal codebase is a TypeScript/TSX application using a typed inline-style token architecture. These are fundamentally different styling and component systems. Applying this plan to the wrong codebase will produce zero output and waste the full 6-hour budget.

| BOTTOM LINE FOR IT LEAD: Confirm which application this plan targets before authorizing execution. If it targets the Harmony home-health scheduling dashboard (a separate app from the DME portal), the plan is approved with 4 minor conditions. If it targets the DME portal, the plan must be rewritten to match the TSX/inline-style architecture. |
| :---- |

# **Findings Summary**

Five findings were identified: one critical blocker, three conditional technical notes, and one HIPAA-specific security concern.

| Severity | ID | Finding | Recommended Action |
| :---- | :---- | :---- | :---- |
| **BLOCKER** | **F-01** | Plan targets .jsx \+ CSS-class/theme.css architecture. HHCA DME Portal is .tsx \+ inline-style tokens (T object). Component names (HUVPage, CertificationsPage, HomeVisitsPage) do not exist in the DME portal. | Confirm the target application before proceeding. See Section 3\. |
| **CONDITIONAL** | **F-02** | ToastContext.jsx uses React Context, which the HHCA rebuild plan explicitly forbids for the DME portal (all state lives in App.tsx, no context providers). | If target is DME portal: implement as a module-level event emitter, not Context. If target is the other app: proceed as written. |
| **CONDITIONAL** | **F-03** | Toast messages passed directly from catch blocks may contain PHI (patient names, IDs) from Firestore error payloads in a clinical/HIPAA environment. | Sanitize all error strings before passing to toast.error(). Log full error to the structured logger; show generic user message. See Section 5\. |
| **CONDITIONAL** | **F-04** | Toast component has no ARIA attributes specified. In a clinical app used by staff with accessibility needs, toast alerts must be discoverable by screen readers. | Add role='alert' and aria-live='assertive' to error toasts. Add aria-live='polite' to success/info toasts. |
| **LOW** | **F-05** | Fix 6 dirty-state guard uses JSON.stringify for comparison, which will miss mutations of nested objects in formData (e.g., address sub-objects). Also, Fix 7 delete button does not guard against state updates on an unmounted component. | Document the JSON.stringify limitation. Add an isMounted ref guard in the delete async flow. |

# **Finding F-01: Codebase Mismatch (BLOCKER)**

## **What the Plan Assumes**

| Plan Assumption | What Was Found in Repository |
| :---- | :---- |
| File extension: .jsx | All components are .tsx (TypeScript JSX) |
| Styling: CSS classes (.btn-primary, .row-clickable) | Styling: Inline styles via T token object (T.accent, T.urgent, etc.) |
| theme.css with \--color-success, \--color-error vars | tokens.ts with typed T constant — no CSS variable system exists |
| constants/icons.js (STATUS\_ICONS) | Icon.tsx — a single SVG component with a 'name' prop |
| src/contexts/AuthContext.jsx, ThemeContext.jsx | Rebuild plan explicitly states: no context providers in the frontend |
| Components: HUVPage, CertificationsPage, HomeVisitsPage | Not found in repo. DME portal has: RequestListView, AdminInbox, PatientsView, etc. |
| NotificationsPage.jsx (email settings) | Notifications exist in TopBar dropdown — not a standalone page |

## **The Two-App Hypothesis**

The component names in the plan (HUVPage — likely Home Unscheduled Visits, CertificationsPage, HomeVisitsPage) strongly suggest this plan targets a separate home health scheduling or care coordination dashboard, distinct from the DME request portal. This would be a companion application for field staff (homemakers, nurses doing home visits) that is not present in the current project knowledge base.

| Action Required from IT Lead: 1\. Confirm: which application does this plan target?    A) The Harmony home-health scheduling dashboard (separate app) — plan is conditionally approved.    B) The HHCA DME Portal — plan must be rewritten for TSX/inline-style architecture. 2\. If (A): provide the repository link or branch for the target application. 3\. Do not assign dev hours until this is confirmed. |
| :---- |

# **Conditional Plan Assessment (If Targeting Correct App)**

Assuming the plan targets the correct application (the companion home-health dashboard), the following assessment applies to the plan's design quality:

## **What the Plan Gets Right**

| Design Decision | Assessment |
| :---- | :---- |
| Execution order respects dependencies | Fix 2 (CSS) before Fix 1 (Toast) before Fix 3 (Wire) is the correct build order. No circular dependencies. |
| Error toasts are persistent (no auto-dismiss) | Correct for a clinical setting. A nurse must not miss an error message because it disappeared. |
| Max 3 visible toasts \+ 1-second dedup | Prevents notification storms during network failures. Well-reasoned. |
| createPortal for toast render layer | Correct. Avoids z-index conflicts with modals and overlays. |
| window.confirm() for dirty-state guard | Correctly justified in the plan. It is blocking by design, which is the right trade-off for a clinical data-entry form. No new UI needed. |
| Delete spinner with finally-block reset | Idempotent by design. The finally block ensures disabled state is always lifted even on error. |
| Fix 4: navigate to Documents instead of alert() | The preferred Option A eliminates dead UX without requiring new infrastructure. |
| Zero changes to service layer, auth, Firebase | Correct scope discipline. This is a pure interaction layer fix. |
| Uses existing CSS vars and STATUS\_ICONS | DRY. Consistent with existing design language. |

## **Minor Technical Conditions**

The following four conditions must be met for plan approval:

### **F-02 — Toast Architecture (No Context Providers)**

If this plan is ever applied to the DME portal (now or in a future merge), ToastContext must not use React Context, as the rebuild architecture forbids it. Recommend implementing toast as a module-level singleton (an event emitter or a simple observer pattern) that any component can import without wrapping the app tree. For the current target app, proceed as written — but document this constraint.

### **F-03 — HIPAA Error Sanitization (Security)**

This is the most important technical condition. Firestore and Firebase Auth throw error objects that can include collection paths, document IDs, or query parameters. In a HIPAA environment, these must never reach the UI. The pattern to enforce across all 7 catch blocks is:

| // WRONG — may leak PHI from Firestore error payload toast.error(error.message); // CORRECT — log full error internally, show safe message to user logger.error('load\_patients\_failed', { error, userId }); toast.error('Failed to load patients. Please refresh or contact support.'); |
| :---- |

**Every toast.error() call added by Fix 3 must use a hardcoded, human-readable string — never error.message or error.toString().**

### **F-04 — ARIA Attributes on Toast**

The toast component must include ARIA roles for accessibility compliance (relevant for any clinical staff using assistive technologies). Implementation is a two-line addition:

| // Error and warning toasts (require immediate attention): \<div role="alert" aria-live="assertive" className="toast toast-error"\> // Success and info toasts (informational, non-urgent): \<div role="status" aria-live="polite" className="toast toast-success"\> |
| :---- |

### **F-05 — Edge Cases in Fix 6 and Fix 7**

**Two low-severity implementation notes:**

* JSON.stringify dirty-check: Will work for flat form fields. Will not detect mutations inside nested objects (e.g., if formData.address is an object that gets a property changed without replacing the reference). Document this limitation in a code comment. If any form field is a nested object, use a deep-equals utility instead.

* Delete button unmount guard (Fix 7): If a user triggers delete and immediately navigates away, setting state on an unmounted component will throw a React warning. Add a useRef(true) mounted guard to the async delete handler and check it before calling setDeleting(false) in the finally block.

# **Verification Addendum**

The plan's 34-item checklist is thorough. Add these 4 items to the final sign-off:

| \# | Additional Verification Item |
| :---- | :---- |
| **35** | HIPAA — trigger a catch block intentionally. Confirm the toast message contains no Firestore path, document ID, or error.message output. Log must show full error; UI must show only the hardcoded string. |
| **36** | Accessibility — use a screen reader (NVDA or VoiceOver) on the toast system. Confirm error toasts are announced immediately. Confirm success toasts do not interrupt active reading. |
| **37** | Fix 6 — open a form whose formData contains a nested object (if applicable). Mutate a nested property. Confirm the dirty guard still fires. |
| **38** | Fix 7 — trigger delete, then immediately navigate to a different view before the operation completes. Confirm no 'Cannot update state on an unmounted component' warning in the browser console. |

# **Decision Gate**

IT Lead: please select the path that applies and return to engineering.

| Decision | Scenario | Engineering Action |
| :---- | :---- | :---- |
| **APPROVE** | Plan targets the home-health scheduling dashboard (separate app) | Provide repo access. Engineering implements with F-02/F-03/F-04/F-05 conditions applied. \~6 hours. |
| **BLOCK** | Plan targets the HHCA DME Portal (React/TSX/T-tokens) | Return plan to author for rewrite. All CSS class references must become inline-style T-token patterns. File extensions must be .tsx. ToastContext must be redesigned as a module-level singleton. Estimate: \+4 hours for rewrite. |

Reviewed by: The Architect — Senior Engineering     Date: April 2, 2026

IT Lead Sign-off: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_     Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_