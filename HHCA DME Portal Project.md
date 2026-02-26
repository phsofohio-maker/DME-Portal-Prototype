  
**PARRISH HEALTH SYSTEMS**

**DME Portal**

Project Development Plan

Prototype to Production Deployment

| Document | Project Development Plan |
| :---- | :---- |
| **Version** | 1.0 |
| **Date** | February 26, 2026 |
| **Classification** | Internal — Confidential |
| **Status** | Draft |

# **Table of Contents**

**1\.**Executive Summary3

**2\.**System Architecture & Tech Stack4

**3\.**HIPAA & Regulatory Compliance5

**4\.**Phase 1 — Foundation (Weeks 1–4)7

**5\.**Phase 2 — Harden (Weeks 5–8)9

**6\.**Phase 3 — Clinical Integration (Weeks 9–12)11

**7\.**Phase 4 — Production Deployment (Weeks 13–16)13

**8\.**Phase 5 — Post-Launch & Scale (Ongoing)14

**9\.**Risk Register15

**10\.**Budget Considerations16

**11\.**Success Metrics & KPIs17

**12\.**Team & Roles18

# **1\. Executive Summary**

The Parrish Health DME Portal is an internal, staff-facing web application that streamlines Durable Medical Equipment requests, medication refill orders, and clinical team communication for Parrish Health Systems. A working prototype has been developed and validated in Google AI Studio, demonstrating the full user workflow across four role types: administrators, nurses, homemakers, and office staff.

This document defines the plan to evolve the prototype into a HIPAA-compliant, production-grade application. The plan spans five phases across approximately 16 weeks of active development, followed by ongoing operational support.

**PROJECT OBJECTIVES**

* Replace localStorage persistence with a secure, multi-user cloud backend (Firebase/GCP)

* Implement HIPAA-compliant authentication, encryption, and audit logging

* Harden all clinical data types and input validation to healthcare-grade standards

* Integrate with EHR/patient registry systems via HL7 FHIR interfaces

* Deploy to production with monitoring, incident response, and BAA coverage

* Achieve staff adoption across Parrish Health’s care coordination teams

**CURRENT STATE ASSESSMENT**

| Dimension | Prototype Status | Production Target |
| :---- | ----- | ----- |
| Authentication | **Client-side PIN** | **Firebase Auth \+ MFA** |
| Data Persistence | **localStorage** | **Firestore \+ backups** |
| Encryption | **None** | **TLS \+ at-rest AES-256** |
| Audit Logging | **Console.log** | **Immutable audit trail** |
| Type Safety | **Partial (details: any)** | **Full discriminated unions** |
| Input Validation | **alert() only** | **Zod schemas \+ server-side** |
| Multi-user | **Single browser** | **Concurrent real-time** |
| EHR Integration | **Mock data** | **HL7 FHIR R4** |

# **2\. System Architecture & Tech Stack**

The production architecture is designed around three principles: HIPAA compliance by default, the existing prototype’s component contracts as the migration surface, and Firebase/GCP as the infrastructure layer to minimize operational overhead for a small team.

## **2.1 Production Tech Stack**

| Layer | Technology | Rationale |
| :---- | :---- | :---- |
| **Frontend** | React 19 \+ TypeScript 5.8 \+ Vite 6 | Retains prototype components; compiled Tailwind via PostCSS |
| **Auth** | Firebase Authentication | Email/password \+ optional TOTP MFA; HIPAA BAA available |
| **Database** | Cloud Firestore | Real-time sync, offline support, Firestore Security Rules for RBAC |
| **Functions** | Firebase Cloud Functions (Node.js) | Server-side validation, email notifications, audit log writes |
| **Storage** | Cloud Storage for Firebase | Secure document/image uploads with signed URLs |
| **Hosting** | Firebase Hosting \+ Cloud CDN | Zero-config SSL, global CDN, atomic deploys |
| **Monitoring** | Cloud Logging \+ Error Reporting | Centralized logs, alerting, HIPAA-eligible |
| **Email** | SendGrid (or Mailgun) | Transactional emails for status changes, invitations |
| **Drug API** | NIH RxNorm REST API | Already integrated; free, authoritative federal data source |
| **EHR Bridge** | HL7 FHIR R4 (future) | Standard healthcare interop protocol for patient registry |

## **2.2 Data Architecture**

The existing firebaseService abstraction provides a clean migration seam. Each localStorage operation maps 1:1 to a Firestore collection. The key structural change is replacing the untyped Request.details field with a discriminated union, and adding server-side Firestore Security Rules that mirror the client-side role checks.

**Firestore Collections:** staff, requests, communications, invitations, audit\_log, dme\_catalog

**Security Model:** Firestore Security Rules enforce that nurses/homemakers/office staff can only read their own requests and messages. Admins can read all requests and update status. Audit log is append-only; no role can delete entries. All writes are validated against Zod schemas in Cloud Functions before persisting.

# **3\. HIPAA & Regulatory Compliance**

This section outlines the technical, administrative, and physical safeguards required under the HIPAA Security Rule (45 CFR Part 164\) and how each is addressed in the system design. This is not legal advice — Parrish Health should engage a HIPAA compliance officer or healthcare attorney to validate these controls.

## **3.1 Business Associate Agreement (BAA)**

Before any Protected Health Information (PHI) enters the system, a BAA must be executed with every third-party service that handles PHI:

* Google Cloud / Firebase — Google offers a BAA covering Firestore, Cloud Functions, Cloud Storage, Firebase Auth, and Cloud Logging. This must be signed at the GCP organization level before project creation.

* SendGrid / Mailgun — If email notifications contain PHI (patient names, request details), the email provider must sign a BAA. Consider stripping PHI from emails and linking to the portal instead.

* Domain registrar and DNS — Typically does not handle PHI, but verify.

* Any future analytics or error-tracking tools must also be BAA-covered before integration.

## **3.2 Technical Safeguards**

| HIPAA Requirement | Implementation | Verification |
| :---- | :---- | :---- |
| **Access Control (164.312(a))** | Firebase Auth with unique user IDs; Firestore Security Rules enforce role-based access; session timeout after 15 min inactivity | Penetration test; Security Rules unit tests |
| **Audit Controls (164.312(b))** | Immutable audit\_log collection in Firestore; every data mutation (create, update, delete) logged with actor, timestamp, before/after state | Log review procedure; quarterly audit |
| **Integrity Controls (164.312(c))** | Zod schema validation on all writes via Cloud Functions; Firestore transactions for atomic updates; no client-side direct writes to critical collections | Integration tests; schema coverage report |
| **Transmission Security (164.312(e))** | TLS 1.3 enforced on all connections (Firebase Hosting default); HSTS headers; no plaintext HTTP | SSL Labs scan; header audit |
| **Encryption at Rest (164.312(a)(2)(iv))** | Firestore encrypts all data at rest with AES-256 by default (Google-managed keys); option to upgrade to CMEK | GCP compliance dashboard |
| **Authentication (164.312(d))** | Email/password with bcrypt hashing (Firebase-managed); optional TOTP MFA for admin accounts; 4-digit PIN removed from auth flow | Auth flow penetration test |
| **Automatic Logoff (164.312(a)(2)(iii))** | Client-side session timeout at 15 minutes; Firebase Auth token expiration at 1 hour with silent refresh | QA test matrix |

## **3.3 Administrative Safeguards**

* Security Officer Designation: Parrish Health must designate a HIPAA Security Officer responsible for ongoing compliance monitoring of the portal.

* Workforce Training: All staff who will use the portal must complete HIPAA training that covers proper use of the system, password hygiene, and incident reporting procedures.

* Incident Response Plan: A documented procedure for breach notification within 72 hours, including investigation, containment, and OCR reporting if \>500 records affected.

* Access Review: Quarterly review of user accounts, roles, and permissions. Immediate revocation upon termination or role change.

* Minimum Necessary Standard: The portal should only display the minimum patient information necessary for each role. Homemakers should not see full clinical details; nurses should not see billing information.

## **3.4 Clinical & Legal Considerations**

* Electronic Signature Validity: The current e-signature (click-to-sign) satisfies ESIGN Act and UETA requirements for internal clinical documents, but should include timestamp, IP address, and user agent for evidentiary weight. Consult legal counsel on whether specific state regulations apply.

* Medical Device Regulation: If the portal makes clinical recommendations or automates ordering decisions, it could be classified as a Clinical Decision Support (CDS) tool under FDA guidance. The current design (human submits, human approves) stays below this threshold. Do not add automated approval logic without regulatory review.

* Record Retention: HIPAA requires 6 years for compliance documentation. Many states require longer for medical records (often 7–10 years). Configure Firestore data retention policies accordingly. Never hard-delete records; use soft-delete with archival.

* State Privacy Laws: If Parrish Health operates in states with enhanced privacy laws (California/CCPA, New York, Texas HB 300), additional obligations may apply. Engage local counsel.

* Insurance Coordination: DME requests often require prior authorization from payers. The portal should generate documentation in formats that satisfy common payer requirements (CMS-1500, prior auth forms).

* ICD-10 Validation: Free-text ICD-10 fields risk invalid codes being submitted to payers, causing claim denials. Implement a validated ICD-10 lookup (similar to the RxNorm integration) to eliminate this risk.

# **4\. Phase 1 — Foundation (Weeks 1–4)**

*Objective: Replace the prototype’s client-side infrastructure with a secure, multi-user backend without changing the user experience.*

## **4.1 Firebase Project Setup**

* Create GCP organization and sign Google Cloud BAA

* Create Firebase project with Blaze (pay-as-you-go) plan for Cloud Functions

* Enable Firebase Auth (email/password provider), Firestore, Cloud Storage, and Hosting

* Configure Firestore in production mode (deny-all default, explicit allow rules)

* Set up Firebase project environments: development, staging, production

* Configure CI/CD pipeline (GitHub Actions) with environment-specific deploys

## **4.2 Authentication Migration**

* Replace the client-side PIN check with Firebase Auth signInWithEmailAndPassword

* Migrate the Onboarding flow to create Firebase Auth accounts (createUserWithEmailAndPassword) and link to Firestore staff profile

* Implement session management: onAuthStateChanged listener, automatic token refresh, 15-minute inactivity timeout

* Admin accounts get optional TOTP MFA via Firebase Auth multi-factor enrollment

* Remove PIN from auth flow entirely; the pin field becomes a legacy artifact

* Update the invitation flow: invitations now send a Firebase Auth email link for account creation

## **4.3 Data Migration**

* Define Firestore schema: staff, requests, communications, invitations, audit\_log, dme\_catalog collections

* Refactor firebaseService.ts: replace every localStorage call with Firestore SDK equivalents (getDoc, setDoc, onSnapshot, etc.)

* Critical type fix: replace Request.details: any with a discriminated union (DMEDetails | MedicationDetails | MultiMedicationDetails)

* Seed the dme\_catalog collection with the existing MOCK\_DME data as the initial production catalog

* Migrate MOCK\_PATIENTS to a patients collection (interim until EHR integration in Phase 3\)

* Implement Firestore Security Rules that enforce role-based read/write access matching the prototype’s client-side checks

## **4.4 Audit Logging Foundation**

Every state-changing operation writes an entry to the audit\_log collection via a Cloud Function trigger. Each entry contains: timestamp, actorId, actorRole, action (e.g., “request.create”, “request.approve”), resourceType, resourceId, and a before/after diff for update operations. The collection is append-only with no client-side delete permissions.

## **4.5 Phase 1 Deliverables**

| Deliverable | Owner | Acceptance |
| :---- | :---- | :---- |
| Firebase project with BAA signed | DevOps / Legal | BAA on file |
| Auth migration (login, onboarding, logout) | Frontend | E2E test suite passes |
| Firestore data layer (all 6 collections) | Backend | CRUD integration tests |
| Firestore Security Rules | Backend | Rules unit tests (100%) |
| Audit log Cloud Function | Backend | Log completeness test |
| CI/CD pipeline to staging | DevOps | Automated deploy on merge |
| Typed Request.details union | Frontend | TypeScript strict mode passes |

# **5\. Phase 2 — Harden (Weeks 5–8)**

*Objective: Elevate data integrity, input validation, and error handling to healthcare-grade standards.*

## **5.1 Input Validation Layer**

* Define Zod schemas for every form submission: DMERequestSchema, MedicationRequestSchema, MultiMedicationRequestSchema, CommunicationSchema

* Client-side: validate on form submission, replace alert() with inline field-level error messages

* Server-side: Cloud Functions validate against the same Zod schemas before Firestore writes (defense in depth)

* ICD-10 validation: integrate a lookup API or static code list to reject invalid codes at submission time

* Medication validation: enforce that RxNorm concept IDs (RxCUIs) are present on all drug selections (not just free text)

## **5.2 Error Handling & Resilience**

* Add React Error Boundaries around each route (Dashboard, DMEForm, MedicationForm, etc.) with branded fallback UI and a “Report Issue” button

* Replace all console.log/alert error handling with a structured error service that logs to Cloud Logging with context (user, route, action, input data)

* Implement optimistic UI updates with rollback: form submissions show success immediately, then reconcile with Firestore confirmation

* Add retry logic with exponential backoff for transient Firestore/network failures

* Implement offline queue: if the device loses connectivity, requests are queued locally and synced when connection returns (Firestore offline persistence)

## **5.3 Admin Workflow Enhancement**

* Add “Request More Information” status (in addition to approved/denied) that sends the request back to the submitter with a note

* Add request history timeline: every status change, note, and actor is displayed chronologically on the request detail view

* Add escalation path: admin can assign a request to another admin or flag it for supervisor review

* Add bulk actions: approve/deny multiple routine requests simultaneously

* Implement email notifications via SendGrid: submitter notified on status change, admin notified on new submission (respecting notification preferences)

## **5.4 UI/UX Hardening**

* Migrate from CDN Tailwind to compiled Tailwind via Vite PostCSS plugin (tree-shaking, deterministic builds)

* Extract LoginPage, Dashboard, AdminInbox, ProfilePage from App.tsx into dedicated modules

* Add loading skeletons for all data-fetching states (replace blank screens)

* Implement keyboard navigation and ARIA labels for accessibility (WCAG 2.1 AA target)

* Add responsive testing matrix: iOS Safari, Android Chrome, desktop Chrome/Edge/Firefox

* Remove the “Copy Code for AI” button from the Profile page

## **5.5 Phase 2 Deliverables**

| Deliverable | Owner | Acceptance |
| :---- | :---- | :---- |
| Zod validation schemas (client \+ server) | Full Stack | 100% form coverage |
| Error boundary \+ structured logging | Frontend | No unhandled crashes |
| Offline queue \+ sync | Frontend | Airplane mode test |
| Admin workflow (RMI, history, escalation) | Full Stack | UAT with admin users |
| SendGrid email integration | Backend | Delivery rate \> 99% |
| Compiled Tailwind \+ component extraction | Frontend | Build size \< 300KB gzip |
| Accessibility audit | QA | WCAG 2.1 AA pass |

# **6\. Phase 3 — Clinical Integration (Weeks 9–12)**

*Objective: Connect the portal to real clinical systems and add production-grade document generation.*

## **6.1 Patient Registry Integration**

Replace the static MOCK\_PATIENTS array with a live connection to Parrish Health’s patient registry. The integration approach depends on the facility’s EHR system:

* Define a PatientLookupService interface that the existing patient search component consumes (decoupling the UI from the data source)

* Option A (preferred): HL7 FHIR R4 Patient resource endpoint — query by name, MRN, or DOB via a Cloud Function proxy that handles authentication and caching

* Option B: Direct database read-replica connection if the EHR exposes one (less standard, more fragile)

* Option C: Nightly CSV/SFTP sync from the EHR into a Firestore patients collection (simplest, but stale data risk)

* Regardless of option, the patient search UI remains unchanged — only the data source behind the interface changes

## **6.2 Document Generation**

* PDF export for approved DME requests: generate a formatted PDF containing all clinical details, equipment selection, ICD-10 codes, authorization signatures, and timestamps

* PDF export for medication orders: formatted prescription-style document suitable for faxing to pharmacies or payer prior-auth departments

* CMS-1500 form pre-population for DME claims: auto-fill standard insurance claim form fields from request data

* All generated documents include a unique document ID, generation timestamp, and a QR code linking back to the portal record

## **6.3 Notification Center**

Add an in-app notification system to complement email notifications:

* Bell icon in the navigation with unread count badge

* Notification types: request status change, new message received, invitation accepted, admin action required

* Notifications persist in a Firestore notifications collection, marked as read on click

* Push notifications via Firebase Cloud Messaging (FCM) for mobile browser users (requires HTTPS, already covered by Firebase Hosting)

## **6.4 Messaging Security Upgrade**

The messaging portal currently claims HIPAA compliance without the infrastructure to support it. This phase makes it real:

* All messages stored in Firestore with server-side access rules (sender and recipient only)

* Message content encrypted at the application layer before Firestore write (AES-256 with per-conversation keys managed via Cloud KMS)

* Audit trail: every message send/read event logged to audit\_log

* Message retention policy: configurable auto-archive after N days with export capability

* Remove the “HIPAA COMPLIANT CHANNEL” badge until this phase is complete and independently verified

# **7\. Phase 4 — Production Deployment (Weeks 13–16)**

*Objective: Deploy to production with security verification, staff training, and operational readiness.*

## **7.1 Security Verification**

* Third-party penetration test against the staging environment (OWASP Top 10 scope minimum)

* Firestore Security Rules audit: verify every collection’s read/write rules against the RBAC matrix

* SSL/TLS configuration audit (SSL Labs A+ target)

* Dependency vulnerability scan (npm audit, Snyk, or Dependabot)

* HIPAA Security Risk Assessment: formal documentation of all safeguards, residual risks, and mitigation plans

## **7.2 Staff Training & Onboarding**

* Create role-specific training materials: Admin Guide, Nurse/Clinician Guide, Homemaker Quick Start

* Conduct hands-on training sessions (in-person or video) for each role group

* HIPAA refresher training that covers portal-specific workflows (proper PHI handling within the system)

* Create a “Frequently Asked Questions” page accessible from the portal’s help menu

* Designate 2–3 “super users” per department as first-line support contacts

## **7.3 Go-Live Checklist**

| Item | Status | Owner |
| :---- | ----- | :---- |
| BAA signed with Google Cloud | **Required** | Legal |
| BAA signed with email provider | **Required** | Legal |
| Penetration test completed, findings remediated | **Required** | Security |
| HIPAA Security Risk Assessment documented | **Required** | Compliance |
| Firestore backup schedule configured (daily) | **Required** | DevOps |
| Incident response plan documented and tested | **Required** | Compliance |
| DNS and SSL certificate configured | **Required** | DevOps |
| Production Firestore security rules deployed | **Required** | Backend |
| Staff training completed for all initial users | **Required** | Training |
| Rollback procedure tested | **Required** | DevOps |
| Error alerting configured (PagerDuty/Slack) | **Required** | DevOps |
| Data retention policy configured | **Recommended** | Compliance |

## **7.4 Deployment Strategy**

A staged rollout reduces risk and allows for iterative feedback:

* Week 13: Deploy to production with admin-only access for final configuration and data seeding

* Week 14: Soft launch with one pilot department (5–10 users). Monitor closely for errors, collect feedback daily.

* Week 15: Expand to all departments. Run the legacy process in parallel for one week as a safety net.

* Week 16: Full cutover. Legacy process retired. Post-launch monitoring intensified for 30 days.

# **8\. Phase 5 — Post-Launch & Scale (Ongoing)**

*Objective: Continuous improvement, compliance maintenance, and feature expansion based on real-world usage data.*

* Monthly review of audit logs for anomalous access patterns

* Quarterly access review: verify all active accounts still have appropriate roles

* Annual HIPAA Security Risk Assessment refresh

* Annual penetration test

* Monitor RxNorm API availability and version updates

* Feature backlog prioritization based on staff feedback and usage telemetry

* Evaluate mobile-native app (React Native) if mobile browser experience proves insufficient for field staff

* Evaluate barcode/QR scanning for DME equipment tracking at the point of delivery

* Evaluate integration with insurance/payer portals for automated prior authorization status checks

# **9\. Risk Register**

| Risk | Likelihood | Impact | Mitigation | Contingency |
| :---- | ----- | ----- | :---- | :---- |
| **EHR integration delays or incompatibility** | **High** | **High** | Define interface early; build with mock adapter that can be swapped | Maintain manual patient entry as fallback; CSV import bridge |
| **Staff resistance to new system** | **Medium** | **High** | Involve nurses in UAT from Phase 2; super-user program; responsive feedback loop | Extended parallel operation period; additional training sessions |
| **HIPAA breach during development** | **Low** | **Critical** | No real PHI in dev/staging; synthetic test data only; BAA before any PHI | Incident response plan; legal counsel on retainer; cyber insurance |
| **Firebase cost overrun** | **Low** | **Medium** | Firestore usage monitoring with budget alerts; query optimization; pagination | Migrate to self-hosted alternative (Supabase) if costs exceed projections |
| **RxNorm API downtime** | **Medium** | **Low** | Cache recent lookups in Firestore; graceful degradation to manual entry | Static drug list fallback seeded from most recent RxNorm export |
| **Key developer departure** | **Medium** | **High** | Documentation-as-code philosophy; pair programming; no single points of knowledge | Comprehensive onboarding docs; external contractor bench identified |

# **10\. Budget Considerations**

The following estimates cover infrastructure and third-party services only. Development labor costs depend on team composition (internal vs. contract) and are not estimated here.

## **10.1 Monthly Infrastructure Costs (Estimated)**

| Service | Low (10 users) | Mid (50 users) | High (200 users) |
| :---- | :---- | :---- | :---- |
| **Firebase Auth** | Free | Free | Free |
| **Firestore (reads/writes/storage)** | $0–$5 | $10–$25 | $50–$100 |
| **Cloud Functions (invocations)** | $0 | $5–$10 | $20–$40 |
| **Firebase Hosting \+ CDN** | $0 | $0–$5 | $5–$15 |
| **Cloud Storage (documents)** | $0 | $1–$3 | $5–$10 |
| **SendGrid (email)** | Free (100/day) | $15–$20 | $20–$50 |
| **Cloud Logging / Monitoring** | $0–$5 | $10–$20 | $25–$50 |
| **Domain \+ SSL** | $12–$20/yr | $12–$20/yr | $12–$20/yr |
| **TOTAL ESTIMATED** | **$2–$30/mo** | **$40–$85/mo** | **$125–$265/mo** |

## **10.2 One-Time Costs**

| Item | Estimated Cost |
| :---- | :---- |
| Third-party penetration test | $3,000–$10,000 |
| HIPAA compliance consulting / legal review | $2,000–$8,000 |
| Cyber liability insurance (annual) | $1,000–$5,000 |
| Staff training development (materials \+ sessions) | $500–$2,000 |

# **11\. Success Metrics & KPIs**

These metrics should be tracked from soft launch onward and reviewed monthly.

| Metric | Baseline (Current) | Target (6 Months) | Measurement |
| :---- | :---- | :---- | :---- |
| **DME request submission time** | Unknown (paper/phone) | \< 3 minutes | Form analytics |
| **Request approval turnaround** | Unknown | \< 24 hours (routine) | Timestamp diff |
| **Staff adoption rate** | 0% | \> 80% active weekly | Auth login counts |
| **Form validation error rate** | N/A (no validation) | \< 5% of submissions | Cloud Function logs |
| **System uptime** | N/A | \> 99.5% | Firebase Status \+ UptimeRobot |
| **Unhandled frontend errors** | Unknown | \< 1 per 100 sessions | Error Reporting |
| **Audit log completeness** | 0% (no logging) | 100% of mutations | Log coverage test |
| **Training completion rate** | 0% | 100% of portal users | Training tracker |
| **Mean time to resolve issues** | N/A | \< 4 hours (P1) | Incident tracker |

# **12\. Team & Roles**

The following roles are required for successful delivery. Individuals may hold multiple roles depending on team size.

| Role | Responsibilities | Phase Involvement |
| :---- | :---- | :---- |
| **Project Lead** | Overall coordination, stakeholder communication, timeline management | All phases |
| **Full-Stack Developer** | Firebase setup, Firestore schema, Cloud Functions, React migration | Phases 1–4 |
| **Frontend Developer** | Component refactoring, validation UI, accessibility, responsive design | Phases 1–4 |
| **HIPAA Compliance Officer** | Risk assessment, policy documentation, training oversight, BAA coordination | Phases 1, 3–5 |
| **Clinical Advisor (Nurse/RN)** | Workflow validation, UAT testing, form accuracy review | Phases 2–4 |
| **QA / Test Engineer** | E2E testing, security rules testing, accessibility audit, device matrix | Phases 2–4 |
| **Healthcare Attorney** | BAA review, e-signature validity, state law compliance, record retention | Phases 1, 3 |
| **DevOps / SRE** | CI/CD, monitoring, incident response setup, backup configuration | Phases 1, 4–5 |

*End of Document*

This plan is a living document and should be updated as decisions are made, risks materialize, and scope evolves. Version history should be maintained in the project repository.

