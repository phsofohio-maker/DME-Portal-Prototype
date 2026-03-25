# HIPAA Security Risk Assessment — DRAFT

**Organization:** Parrish Health Home Care Agency (HHCA)
**System:** DME & Logistics Staff Portal v2.0
**Assessment Date:** March 2026
**Prepared By:** Engineering Team (automated draft)
**Status:** DRAFT — Requires review by a qualified HIPAA Compliance Officer

> **IMPORTANT DISCLAIMER**
> This document is a structured engineering draft. It does NOT constitute legal
> advice and has NOT been reviewed by a compliance professional. A qualified
> HIPAA Security Officer or healthcare attorney MUST review, amend, and approve
> this assessment before it satisfies the 45 CFR 164.308(a)(1)(ii)(A)
> requirement. Do not treat this draft as a completed risk assessment.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope and System Description](#2-scope-and-system-description)
3. [Asset Inventory](#3-asset-inventory)
4. [HIPAA Security Rule Safeguard Mapping](#4-hipaa-security-rule-safeguard-mapping)
5. [Threat and Vulnerability Analysis](#5-threat-and-vulnerability-analysis)
6. [Risk Rating Matrix](#6-risk-rating-matrix)
7. [Detailed Risk Register](#7-detailed-risk-register)
8. [Residual Risk Summary](#8-residual-risk-summary)
9. [Remediation Roadmap](#9-remediation-roadmap)
10. [Appendices](#10-appendices)

---

## 1. Executive Summary

The Parrish Health DME Portal is a web-based staff application for managing
Durable Medical Equipment (DME) requests, medication orders, and clinical
communications. The system processes Protected Health Information (PHI)
including patient names, MRNs, dates of birth, diagnoses (ICD-10 codes),
insurance identifiers, and clinical notes.

This assessment identifies **14 risk items** across the system's technology
stack, maps each to the applicable HIPAA Security Rule requirement, rates
residual risk after current safeguards, and identifies gaps requiring
remediation before production deployment.

**Key findings:**
- Strong technical safeguards are in place: RBAC, audit logging, encryption
  at rest and in transit, session timeout, and MFA for admins.
- **Critical gaps** requiring action: BAA execution with Google Cloud and
  SendGrid, third-party penetration test, and formal workforce training.
- **Moderate gaps**: client-side encryption key management, offline cache
  PHI exposure, and QR code service dependency.

---

## 2. Scope and System Description

### 2.1 System Boundary

| Component | Technology | PHI Contact |
|-----------|-----------|-------------|
| Web Client | React SPA (Vite + TypeScript) | Yes — renders patient data in browser |
| Authentication | Firebase Authentication | Yes — user identity tied to PHI access |
| Database | Cloud Firestore | Yes — stores all PHI records |
| Server Logic | Firebase Cloud Functions (Node.js) | Yes — processes requests, sends notifications |
| Email Notifications | SendGrid API | Conditional — depends on email content |
| Push Notifications | Firebase Cloud Messaging (FCM) | Minimal — notification titles only |
| Static Hosting | Firebase Hosting | No — serves static assets only |
| PDF Generation | jsPDF (client-side) | Yes — generates CMS-1500 forms with PHI |
| QR Code Generation | External API (qrserver.com) | No — encodes portal URLs, not PHI |

### 2.2 PHI Data Elements Processed

| Data Element | HIPAA Category | Storage Location |
|-------------|---------------|-----------------|
| Patient full name | Direct identifier | Firestore `requests`, `patients` |
| Medical Record Number (MRN) | Direct identifier | Firestore `patients` |
| Date of birth | Direct identifier | Firestore `patients` |
| ICD-10 diagnosis codes | Clinical information | Firestore `requests` |
| Insurance ID / carrier | Financial information | Firestore `patients` |
| Prescription details | Clinical information | Firestore `requests` |
| Clinical justification notes | Clinical information | Firestore `requests` |
| Staff-to-staff messages | May contain clinical info | Firestore `communications` |
| Administrative notes | May contain clinical info | Firestore `requests` |

### 2.3 User Roles

| Role | Population | PHI Access Level |
|------|-----------|-----------------|
| Admin | ~2-5 | Full access to all requests, patient records, audit logs, team management |
| Nurse | ~10-20 | Own requests, patient search, messaging |
| Office Staff | ~5-10 | Own requests, patient search, messaging |

---

## 3. Asset Inventory

### 3.1 Cloud Infrastructure

| Asset | Provider | Data Classification | BAA Required | BAA Status |
|-------|----------|-------------------|-------------|-----------|
| Cloud Firestore | Google Cloud | PHI — primary data store | Yes | **ACTION REQUIRED** |
| Firebase Authentication | Google Cloud | PII — user credentials | Yes (covered by GCP BAA) | **ACTION REQUIRED** |
| Cloud Functions | Google Cloud | PHI — server-side processing | Yes (covered by GCP BAA) | **ACTION REQUIRED** |
| Firebase Hosting | Google Cloud | Non-PHI — static assets | Yes (covered by GCP BAA) | **ACTION REQUIRED** |
| Cloud Logging | Google Cloud | PHI — may contain request data | Yes (covered by GCP BAA) | **ACTION REQUIRED** |
| Firebase Cloud Messaging | Google Cloud | Minimal — notification titles | Yes (covered by GCP BAA) | **ACTION REQUIRED** |
| SendGrid | Twilio | Conditional — email content | Yes, if emails contain PHI | **ACTION REQUIRED** |

### 3.2 Client-Side Assets

| Asset | Technology | Data Classification | Notes |
|-------|-----------|-------------------|-------|
| Browser application | React SPA | PHI — rendered in DOM | Data in memory only during session |
| IndexedDB (Firestore cache) | Persistent local cache | PHI — offline persistence | Multi-tab manager enabled |
| PDF documents | jsPDF (client-side) | PHI — generated documents | Downloaded to user's device |
| Encryption keys | AES-GCM-256 | Cryptographic material | Stored in Firestore `conversationKeys` |

### 3.3 Third-Party Dependencies

| Dependency | Purpose | PHI Contact | Risk |
|-----------|---------|-------------|------|
| qrserver.com API | QR code generation for MFA | No — encodes URLs only | Low — availability risk |
| npm packages | Application build | No | Supply chain risk — managed via lockfile |

---

## 4. HIPAA Security Rule Safeguard Mapping

### 4.1 Administrative Safeguards — 45 CFR 164.308

| Requirement | Section | Implementation | Status | Verification |
|------------|---------|---------------|--------|-------------|
| Security Management Process | §308(a)(1) | This risk assessment document | **DRAFT** | Compliance officer review |
| Risk Analysis | §308(a)(1)(ii)(A) | This document | **DRAFT** | Compliance officer review |
| Risk Management | §308(a)(1)(ii)(B) | Remediation roadmap (§9) | **DRAFT** | Track remediation items |
| Sanction Policy | §308(a)(1)(ii)(C) | Not yet documented | **GAP** | Requires HR policy document |
| Information System Activity Review | §308(a)(1)(ii)(D) | Audit log with admin viewer (`/admin/audit-log`), Cloud Function logging | Implemented | Review audit_log collection |
| Assigned Security Responsibility | §308(a)(2) | Not yet assigned | **GAP** | Designate HIPAA Security Officer |
| Workforce Authorization | §308(a)(3) | RBAC roles (admin, nurse, office_staff), invitation-only registration | Implemented | Verify via Firestore `staff` collection |
| Workforce Clearance | §308(a)(3)(ii)(B) | Admin invitation flow with role assignment | Implemented | Test invitation flow |
| Termination Procedures | §308(a)(3)(ii)(C) | Soft-delete (status: 'suspended'), no hard deletes | Implemented | Verify suspended users cannot authenticate |
| Security Awareness Training | §308(a)(5) | Not yet conducted | **GAP** | Requires training program |
| Security Incident Procedures | §308(a)(6) | Not yet documented | **GAP** | Requires incident response plan |
| Contingency Plan | §308(a)(7) | Firebase automatic backups, multi-region option | Partial | Document recovery procedures |
| Evaluation | §308(a)(8) | Penetration test scheduled (Block 10) | **PENDING** | Schedule third-party assessment |
| BAA with Google Cloud | §308(b)(1) | Not yet executed | **ACTION REQUIRED** | Execute in GCP Console |
| BAA with SendGrid | §308(b)(1) | Not yet executed | **ACTION REQUIRED** | Contact SendGrid support |

### 4.2 Physical Safeguards — 45 CFR 164.310

| Requirement | Section | Implementation | Status | Verification |
|------------|---------|---------------|--------|-------------|
| Facility Access Controls | §310(a)(1) | N/A — fully cloud-hosted (Google Cloud data centers) | Covered by GCP BAA | Google SOC 2 / ISO 27001 |
| Workstation Use | §310(b) | Not documented | **GAP** | Requires acceptable use policy |
| Workstation Security | §310(c) | 15-minute inactivity timeout (HIPAA auto-logoff) | Implemented | Verify timeout in Layout.tsx |
| Device and Media Controls | §310(d)(1) | No removable media; PDF export is client-side download | Partial | Document PDF handling procedures |

### 4.3 Technical Safeguards — 45 CFR 164.312

| Requirement | Section | Implementation | Status | Verification |
|------------|---------|---------------|--------|-------------|
| **Access Control** | §312(a)(1) | Firebase Auth + Firestore Security Rules enforce RBAC | Implemented | 75 Firestore rules tests passing |
| Unique User Identification | §312(a)(2)(i) | Firebase Auth UID per user; email-based login | Implemented | Verify in Auth console |
| Emergency Access | §312(a)(2)(ii) | Firebase Admin SDK bypass available | Partial | Document emergency access procedure |
| Automatic Logoff | §312(a)(2)(iii) | 15-minute inactivity timeout with 2-minute warning modal; `auth.timeout` audit action | Implemented | 8 unit tests; verify in Layout.tsx |
| Encryption at Rest | §312(a)(2)(iv) | Firestore AES-256 encryption at rest (Google-managed); application-layer AES-GCM-256 for messages | Implemented | Verify Firestore encryption settings |
| **Audit Controls** | §312(b) | Append-only `audit_log` collection; client writes blocked; Cloud Functions log all state changes | Implemented | 60 Cloud Function tests; HIPAA field completeness test |
| **Integrity Controls** | §312(c)(1) | No client-side deletes on any collection; Zod schema validation on all inputs; immutable message bodies | Implemented | 123 Zod schema tests; Firestore rules block delete |
| Authentication of PHI | §312(c)(2) | Firestore Security Rules validate data structure on create; `submitterId == request.auth.uid` enforced | Implemented | Rules tests verify field requirements |
| **Person/Entity Authentication** | §312(d) | Email + password via Firebase Auth; TOTP MFA enforced for admin accounts | Implemented | MFA enrollment + challenge flow in App.tsx |
| **Transmission Security** | §312(e)(1) | TLS 1.3 enforced by Firebase Hosting (HSTS); Firestore SDK uses TLS | Implemented | Verify HSTS header in firebase.json |
| Encryption in Transit | §312(e)(2)(ii) | All Firebase SDK traffic over TLS 1.2+; application-layer AES-GCM-256 for stored messages | Implemented | Verify via browser DevTools network tab |

---

## 5. Threat and Vulnerability Analysis

### 5.1 Threat Categories

| Threat ID | Threat | Applicable Assets | Current Mitigation |
|-----------|--------|------------------|-------------------|
| T-01 | Unauthorized access — credential theft | Firebase Auth, Firestore | MFA for admins, strong password requirements |
| T-02 | Unauthorized access — privilege escalation | Firestore Security Rules | Server-side role checks, admin-only collections |
| T-03 | Data interception — network eavesdropping | All network traffic | TLS 1.3 (HSTS), application-layer encryption for messages |
| T-04 | Data loss — accidental deletion | Firestore | No-delete rules on all collections, soft-delete pattern |
| T-05 | Data loss — infrastructure failure | Google Cloud | Firestore multi-region replication, automatic backups |
| T-06 | Insider threat — staff misuse | All PHI data | Audit logging, RBAC, minimum necessary access |
| T-07 | Insider threat — admin abuse | All PHI data | Audit log (admin actions logged), MFA requirement |
| T-08 | Session hijacking | Browser client | 15-min timeout, HTTPS-only cookies, SameSite attributes |
| T-09 | XSS / injection | Browser client | React auto-escaping, Zod input validation, no dangerouslySetInnerHTML |
| T-10 | Supply chain — npm dependency | Build pipeline | package-lock.json lockfile, npm audit |
| T-11 | Client-side data exposure | IndexedDB offline cache | Firestore persistent cache stores PHI locally |
| T-12 | Email PHI leakage | SendGrid notifications | Email content may include patient names/request details |
| T-13 | Encryption key compromise | conversationKeys collection | Keys stored in Firestore, access restricted to participants |
| T-14 | Denial of service | Firebase Hosting, Functions | Firebase automatic scaling; no rate limiting configured |

### 5.2 Vulnerability Assessment

| Vuln ID | Vulnerability | Threat Link | Current Control | Gap |
|---------|-------------|-------------|----------------|-----|
| V-01 | No BAA with Google Cloud | T-01 through T-07 | None | **CRITICAL — blocks HIPAA compliance** |
| V-02 | No BAA with SendGrid | T-12 | None | **HIGH — if emails contain PHI** |
| V-03 | No penetration test | T-01, T-02, T-09 | Code review, Firestore rules tests | **HIGH — required for compliance** |
| V-04 | IndexedDB stores PHI unencrypted | T-11 | Firestore persistent cache | **MODERATE — device theft risk** |
| V-05 | Conversation keys in Firestore | T-13 | Security Rules restrict to participants | **LOW — key rotation not implemented** |
| V-06 | No rate limiting on Cloud Functions | T-14 | Firebase auto-scaling | **LOW — cost risk, not PHI risk** |
| V-07 | QR code generation uses external API | T-10 | URL data only, no PHI | **LOW — availability risk only** |
| V-08 | No formal incident response plan | T-01 through T-14 | None | **HIGH — required by §308(a)(6)** |
| V-09 | No workforce HIPAA training | T-06, T-07 | None | **HIGH — required by §308(a)(5)** |
| V-10 | No sanction policy documented | T-06, T-07 | None | **MODERATE — required by §308(a)(1)(ii)(C)** |

---

## 6. Risk Rating Matrix

### 6.1 Scoring Methodology

**Likelihood** (1-5):
1. Rare — once per decade
2. Unlikely — once per several years
3. Possible — once per year
4. Likely — multiple times per year
5. Almost certain — continuous exposure

**Impact** (1-5):
1. Negligible — no PHI exposure, no operational impact
2. Minor — limited PHI exposure (<10 records), contained
3. Moderate — significant PHI exposure, potential breach notification
4. Major — large-scale PHI exposure, regulatory investigation
5. Catastrophic — systemic breach, loss of operations, legal action

**Risk Score** = Likelihood × Impact

| Score Range | Rating | Action Required |
|------------|--------|----------------|
| 1-4 | Low | Accept or monitor |
| 5-9 | Moderate | Mitigate within 90 days |
| 10-15 | High | Mitigate within 30 days |
| 16-25 | Critical | Immediate action required |

---

## 7. Detailed Risk Register

| Risk ID | Description | Threat | Likelihood | Impact | Score | Rating | Safeguard | Residual Risk |
|---------|-------------|--------|-----------|--------|-------|--------|-----------|--------------|
| R-01 | No BAA with Google Cloud | T-01–T-07 | 5 | 5 | **25** | **CRITICAL** | None | Execute BAA immediately |
| R-02 | No BAA with SendGrid | T-12 | 4 | 4 | **16** | **CRITICAL** | Strip PHI from emails OR execute BAA | Mitigate before go-live |
| R-03 | No penetration test | T-01, T-09 | 3 | 4 | **12** | **HIGH** | Firestore rules tests (75), Zod validation (123 tests) | Schedule test before go-live |
| R-04 | No incident response plan | T-all | 3 | 4 | **12** | **HIGH** | None | Draft IR plan |
| R-05 | No workforce HIPAA training | T-06, T-07 | 3 | 3 | **9** | **MODERATE** | Role-based access limits exposure | Conduct training before go-live |
| R-06 | IndexedDB offline cache stores PHI | T-11 | 2 | 3 | **6** | **MODERATE** | Device access controls (org policy) | Accept with documented justification |
| R-07 | No sanction policy | T-06 | 2 | 3 | **6** | **MODERATE** | Audit logging deters misuse | Document policy |
| R-08 | Conversation key rotation not implemented | T-13 | 1 | 3 | **3** | **LOW** | Firestore rules restrict access to participants | Accept — implement in future phase |
| R-09 | No Cloud Function rate limiting | T-14 | 2 | 1 | **2** | **LOW** | Firebase auto-scaling, budget alerts | Accept with cost monitoring |
| R-10 | External QR code API dependency | T-10 | 2 | 1 | **2** | **LOW** | Fallback: manual key entry available | Accept |
| R-11 | Admin account compromise | T-01 | 2 | 5 | **10** | **HIGH** | TOTP MFA, audit logging, session timeout | Monitor audit logs |
| R-12 | Staff credential phishing | T-01 | 3 | 3 | **9** | **MODERATE** | Firebase Auth, password reset flow | Security awareness training |
| R-13 | Accidental PHI in git repository | T-06 | 2 | 4 | **8** | **MODERATE** | .env in .gitignore, no PHI in source | Pre-commit hooks recommended |
| R-14 | PDF export — PHI on local device | T-11 | 3 | 2 | **6** | **MODERATE** | Client-side generation, no server copy | Document acceptable use policy |

### Risk Distribution

| Rating | Count | Risk IDs |
|--------|-------|----------|
| Critical | 2 | R-01, R-02 |
| High | 3 | R-03, R-04, R-11 |
| Moderate | 5 | R-05, R-06, R-07, R-12, R-13, R-14 |
| Low | 3 | R-08, R-09, R-10 |

---

## 8. Residual Risk Summary

### 8.1 Risks Fully Mitigated by Current Controls

| HIPAA Requirement | Control | Evidence |
|------------------|---------|----------|
| Access Control §312(a) | Firestore Security Rules + Firebase Auth RBAC | 75 rules tests passing |
| Audit Controls §312(b) | Append-only audit_log, Cloud Function logging | 60 CF tests, HIPAA field completeness test |
| Integrity §312(c) | No-delete rules, Zod validation, immutable messages | 123 schema tests, rules block delete |
| Person Authentication §312(d) | Firebase Auth + TOTP MFA for admins | MFA enrollment + challenge components |
| Automatic Logoff §312(a)(2)(iii) | 15-min inactivity timeout with audit action | 8 timeout tests |
| Transmission Security §312(e) | TLS 1.3 (HSTS), AES-GCM-256 message encryption | Firebase Hosting enforces HSTS |
| Workforce Authorization §308(a)(3) | Invitation-only registration, admin role assignment | Firestore invitations collection |
| Termination §308(a)(3)(ii)(C) | Soft-delete status:'suspended' | No hard deletes permitted |

### 8.2 Risks Accepted with Documented Justification

| Risk ID | Description | Justification | Review Date |
|---------|-------------|--------------|-------------|
| R-06 | IndexedDB offline cache | Firestore persistent cache is required for offline access; physical device security is an organizational control | 6 months |
| R-08 | No key rotation | Conversation keys are per-pair and access-controlled; rotation adds complexity without proportional risk reduction | 12 months |
| R-09 | No rate limiting | Firebase auto-scales; financial monitoring via GCP budget alerts | 6 months |
| R-10 | External QR API | No PHI transmitted; manual entry fallback available | 12 months |

### 8.3 Risks Requiring Remediation Before Go-Live

| Risk ID | Description | Assigned To | Target Date | Blocker? |
|---------|-------------|------------|-------------|----------|
| R-01 | Execute BAA with Google Cloud | Organization Admin | ASAP | **YES** |
| R-02 | Execute BAA with SendGrid (or strip PHI from emails) | Organization Admin | Before go-live | **YES** |
| R-03 | Schedule and complete penetration test | Organization Admin | Before go-live | **YES** |
| R-04 | Draft incident response plan | HIPAA Security Officer | Before go-live | **YES** |
| R-05 | Conduct workforce HIPAA training | HIPAA Security Officer | Before go-live | Recommended |
| R-07 | Document sanction policy | HR / Compliance | Before go-live | Recommended |

---

## 9. Remediation Roadmap

### Phase 1 — Critical (Immediate)

| # | Action | Owner | Effort | Notes |
|---|--------|-------|--------|-------|
| 1 | Execute Google Cloud BAA | Org Admin | 1 hour | GCP Console → Organization → Settings |
| 2 | Execute SendGrid BAA or strip PHI from emails | Org Admin / Engineering | 1-4 hours | Alternative: generic email templates |

### Phase 2 — High Priority (Within 30 days)

| # | Action | Owner | Effort | Notes |
|---|--------|-------|--------|-------|
| 3 | Schedule penetration test | Org Admin | 1-2 weeks lead time | Use HIPAA-experienced firm |
| 4 | Draft incident response plan | Security Officer | 4-8 hours | Template available from HHS.gov |
| 5 | Remediate penetration test findings | Engineering | Variable | Depends on findings |

### Phase 3 — Moderate Priority (Within 90 days)

| # | Action | Owner | Effort | Notes |
|---|--------|-------|--------|-------|
| 6 | Conduct workforce HIPAA training | Security Officer | 2-4 hours | Portal-specific training module |
| 7 | Document sanction policy | HR / Compliance | 2-4 hours | Standard HR document |
| 8 | Document acceptable use policy | HR / Compliance | 2-4 hours | Workstation use, PDF handling |
| 9 | Implement pre-commit hooks for PHI scanning | Engineering | 2 hours | Prevent accidental PHI in repo |

### Phase 4 — Low Priority (Monitor)

| # | Action | Owner | Effort | Notes |
|---|--------|-------|--------|-------|
| 10 | Evaluate conversation key rotation strategy | Engineering | 4-8 hours | Assess need based on usage patterns |
| 11 | Implement Cloud Function rate limiting | Engineering | 2-4 hours | Firebase App Check or custom middleware |
| 12 | Set up GCP budget alerts | Org Admin | 30 minutes | Prevent unexpected cost from abuse |

---

## 10. Appendices

### Appendix A: Firestore Collections and PHI Classification

| Collection | PHI? | Access Control | Delete Allowed | Audit Logged |
|-----------|------|---------------|---------------|-------------|
| `staff` | PII (email, name) | Owner or admin | No (soft-delete) | Yes — staff.update, staff.suspend |
| `requests` | **Yes** — patient data, diagnoses | Submitter or admin | No | Yes — request.create, .approve, .deny, .rmi |
| `communications` | **Yes** — clinical messages | Sender and recipient only | No | Yes — communication.create |
| `patients` | **Yes** — full patient record | Active staff (read), admin (write) | No | Via staff profile updates |
| `audit_log` | Metadata only | Admin (read), server-only (write) | No | N/A — is the audit trail |
| `notifications` | Minimal — titles only | Recipient only | No | Created server-side |
| `invitations` | PII (email) | Admin only | No | Yes — invitation.create, .revoke |
| `dme_catalog` | No | Active staff (read), admin (write) | Admin only | No |
| `conversationKeys` | Crypto keys | Two participants only | No | No |

### Appendix B: Audit Log Actions

| Action | Trigger | Fields Captured |
|--------|---------|----------------|
| `auth.login` | User signs in | actorId, actorRole, timestamp |
| `auth.logout` | User signs out | actorId, actorRole, timestamp |
| `auth.timeout` | 15-min inactivity auto-logoff | actorId, actorRole, timestamp |
| `auth.mfa_enrollment` | Admin sets up TOTP MFA | actorId, actorRole, timestamp |
| `auth.mfa_challenge` | Admin completes MFA during login | actorId, actorRole, timestamp |
| `request.create` | New DME/medication request | actorId, actorRole, resourceId, full request payload |
| `request.approve` | Admin approves request | actorId, actorRole, resourceId, before/after state |
| `request.deny` | Admin denies request | actorId, actorRole, resourceId, before/after state |
| `request.rmi` | Admin requests more info | actorId, actorRole, resourceId, before/after state |
| `request.escalate` | Request escalated | actorId, actorRole, resourceId |
| `request.bulk_approve` | Bulk approval | actorId, actorRole, resourceIds |
| `request.bulk_deny` | Bulk denial | actorId, actorRole, resourceIds |
| `staff.create` | New staff profile created | actorId, actorRole, resourceId |
| `staff.update` | Staff profile updated | actorId, actorRole, resourceId, before/after |
| `staff.suspend` | Staff account suspended | actorId, actorRole, resourceId |
| `communication.create` | Message sent | actorId, actorRole, resourceId |
| `invitation.create` | Staff invitation sent | actorId, actorRole, resourceId |
| `invitation.revoke` | Invitation revoked | actorId, actorRole, resourceId |

### Appendix C: Test Coverage Summary

| Test Suite | Tests | Coverage Area |
|-----------|-------|--------------|
| Firestore Security Rules | 75 | Access control enforcement for 9 collections |
| Zod Schema Validation | 123 | Input validation for 5 domain schemas |
| Cloud Function Integration | 60 | All 9 handlers, audit trail completeness |
| Session Timeout | 8 | HIPAA automatic logoff timing and reset |
| Component Smoke Tests | 32 | LoginPage, Dashboard, DMEForm, AdminInbox, MessagingPortal |
| **Total** | **298** | |

### Appendix D: Encryption Summary

| Layer | Algorithm | Key Management | Scope |
|-------|----------|---------------|-------|
| Data at rest (Firestore) | AES-256 | Google-managed | All Firestore data |
| Data at rest (messages) | AES-GCM-256 | Per-conversation key in Firestore | `communications` collection |
| Data in transit | TLS 1.2+ (HSTS enforced) | Google-managed certificates | All network traffic |
| User passwords | bcrypt (Firebase Auth) | Google-managed | Authentication |
| MFA secrets | TOTP (RFC 6238) | Firebase Auth managed | Admin second factor |

### Appendix E: Regulatory References

| Regulation | Section | Description |
|-----------|---------|-------------|
| 45 CFR 164.308 | Administrative Safeguards | Security management, workforce security, access management |
| 45 CFR 164.310 | Physical Safeguards | Facility access, workstation use, device controls |
| 45 CFR 164.312 | Technical Safeguards | Access control, audit, integrity, authentication, transmission |
| 45 CFR 164.314 | Organizational Requirements | BAA requirements |
| 45 CFR 164.316 | Policies and Procedures | Documentation requirements |
| 45 CFR 164.530(j) | Retention | 6-year retention for HIPAA compliance documentation |

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 DRAFT | March 2026 | Engineering (automated) | Initial draft — awaiting compliance review |

**Next Steps:**
1. HIPAA Security Officer reviews and amends this document
2. Execute BAAs (R-01, R-02)
3. Schedule penetration test (R-03)
4. Draft incident response plan (R-04)
5. Conduct workforce training (R-05)
6. Final compliance officer sign-off
