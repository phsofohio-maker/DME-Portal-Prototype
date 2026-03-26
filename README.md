# HHCA DME Portal

**Harmony Health Care Assistant — DME & Employee Portal**

A HIPAA-compliant, staff-facing web application that streamlines Durable Medical Equipment (DME) requests, medication refill orders, and clinical team communication for Parrish Health Systems of Ohio.

> **Status:** Active Development · Phase 2 Complete · Phase 3 (Verification & Integration) In Progress  
> **Internal Deployment Target:** ~June 2026 (Week 14)  
> **Multi-Tenant Readiness Target:** ~August 2026 (Week 26)

---

## Problem

Parrish Health's care coordination teams manage DME requests, medication refills, and inter-staff communication through fragmented email and phone-based workflows. This leads to lost requests, unclear accountability, delayed approvals, and no audit trail — all in an environment where HIPAA compliance is non-negotiable.

## Solution

A single portal that replaces email-based form submissions with a structured, role-aware workflow. Four staff roles (Administrator, Nurse, Homemaker, Office Staff) interact with a shared request pipeline that enforces validation, tracks every state change, and maintains an immutable audit log.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 19 + TypeScript 5.8 + Vite 6 | Component-based SPA with strict type safety |
| Auth | Firebase Authentication | Email/password + optional TOTP MFA; HIPAA BAA eligible |
| Database | Cloud Firestore | Real-time sync, offline support, Security Rules for RBAC |
| Server Logic | Firebase Cloud Functions (Node.js) | Server-side validation, email triggers, audit log writes |
| Hosting | Firebase Hosting + Cloud CDN | Zero-config SSL, global CDN, atomic deploys |
| Validation | Zod (client + server) | Shared schemas enforce data integrity at both boundaries |
| Drug Data | NIH RxNorm REST API | Authoritative federal drug database, free |
| Diagnostics | NIH Clinical Tables API | ICD-10 code lookup with debounced search |
| Email | Firebase Trigger Email Extension | SMTP delivery via Firestore `mail` collection |
| Monitoring | Cloud Logging + Error Reporting | Centralized, HIPAA-eligible logging |

---

## Project Structure

```
parrish-dme-portal/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── firebase.json
├── firestore.rules              # 180+ lines, RBAC for all 8 collections
├── functions/
│   └── src/
│       ├── index.ts             # Cloud Functions (5 triggers + 1 callable)
│       └── schemas.ts           # Server-side Zod schemas
├── src/
│   ├── main.tsx
│   ├── App.tsx                  # Root: auth state, routing, data subscriptions
│   ├── tokens.ts                # Design tokens (inline styles)
│   ├── types.ts                 # Full TypeScript interfaces, discriminated unions
│   ├── data/                    # Seed data (staff, patients, catalog, drugs)
│   ├── lib/
│   │   └── schemas.ts           # Client-side Zod schemas
│   ├── services/
│   │   ├── firebaseService.ts   # Firestore CRUD, Auth, real-time subscriptions
│   │   ├── logger.ts            # Structured logger (6 levels, HIPAA-safe audit)
│   │   └── pdfService.ts        # PDF export via jsPDF
│   ├── components/
│   │   ├── Forms/
│   │   │   ├── DMEForm.tsx      # Zod-validated DME request form
│   │   │   ├── MedicationForm.tsx
│   │   │   ├── MultiMedicationForm.tsx
│   │   │   └── ICD10Field.tsx   # NIH Clinical Tables integration
│   │   ├── Icon.tsx, Badge.tsx, StatusPill.tsx, Card.tsx, ...
│   │   ├── Sidebar.tsx
│   │   └── TopBar.tsx
│   └── views/
│       ├── LoginScreen.tsx
│       ├── DashboardView.tsx
│       ├── AdminInbox.tsx
│       ├── RequestDetailView.tsx
│       ├── NewRequestView.tsx
│       ├── MessagesView.tsx
│       ├── TeamView.tsx
│       ├── PatientsView.tsx
│       ├── PatientDetailView.tsx
│       ├── HelpView.tsx
│       └── SettingsView.tsx
└── guides/                      # Internal documentation and reports
```

---

## Data Architecture

Eight Firestore collections with role-based Security Rules:

| Collection | Purpose | Access |
|-----------|---------|--------|
| `staff` | User profiles, roles, preferences | Read: authenticated; Write: self (profile) or admin |
| `requests` | DME, medication, multi-med requests | Read: own or admin; Create: active staff; Update: admin |
| `communications` | Encrypted messaging threads | Read: sender + recipient only; Create: active staff |
| `invitations` | Pending staff invitations | Read/Create/Update: admin only |
| `audit_log` | Immutable audit trail | Read: admin; Write: Cloud Functions only; No deletes |
| `dme_catalog` | Equipment catalog (categories, items, SKUs) | Read: active staff; Write: admin only |
| `patients` | Interim patient registry (pre-FHIR) | Read: active staff; Write: admin only |
| `notifications` | In-app notification system | Read: own only; Create: Cloud Functions only |

The `Request.details` field uses a discriminated union (`DMERequestDetails | MedicationRequestDetails | MultiMedicationRequestDetails`) with a `kind` discriminator to ensure type-safe handling across all request types.

---

## Cloud Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `onNewRequest` | Firestore `onCreate` on `requests` | Emails all active admins when a new request is submitted |
| `onRequestStatusChange` | Firestore `onUpdate` on `requests` | Emails the submitter when their request is approved, denied, or RMI'd |
| `onNewMessage` | Firestore `onCreate` on `communications` | Emails the recipient (respects notification preferences) |
| `onNewInvitation` | Firestore `onCreate` on `invitations` | Creates Auth account server-side, generates password-reset link, sends branded invitation email |
| `logAuthEvent` | Callable | Records login/logout events to `audit_log` |

All email functions write to the `mail` Firestore collection. The Firebase Trigger Email Extension handles SMTP delivery. No clinical data (PHI) is included in any email body.

---

## Authentication & Authorization

The portal uses Firebase Authentication with email/password. The invitation flow is fully server-side: when an admin invites a new staff member, the client writes to the `invitations` collection, and the `onNewInvitation` Cloud Function creates the Auth account via Admin SDK, generates a password-reset link, and sends a branded invitation email — avoiding the client-side `createUserWithEmailAndPassword` side effect that previously signed the admin out.

Four roles are enforced via Firestore Security Rules: `admin`, `nurse`, `homemaker`, `office_staff`. Role checks are applied at both the UI layer (conditional rendering) and the data layer (Security Rules reject unauthorized writes).

---

## HIPAA Compliance Posture

| Safeguard | Implementation | Status |
|-----------|---------------|--------|
| Access Control (§164.312(a)) | Firebase Auth + Firestore Security Rules with RBAC | Done |
| Audit Controls (§164.312(b)) | Immutable `audit_log`; Cloud Function triggers; before/after diffs | Done |
| Integrity Controls (§164.312(c)) | Zod validation (client + server); no client-side writes to critical collections | Done |
| Transmission Security (§164.312(e)) | TLS 1.3 via Firebase Hosting; HSTS preload | Done |
| Encryption at Rest | Firestore AES-256 (Google-managed keys) | Done |
| Application-Layer Encryption | AES-256 for messaging content | Done |
| BAA — Google Cloud | Required before any PHI enters the system | Pending (Legal) |

---

## Development Phases

| Phase | Name | Weeks | Status |
|-------|------|-------|--------|
| 1 | Foundation | 1–2 | **Complete** (95%) |
| 2 | Harden & Polish | 3–4 | **Complete** (100%) |
| 3 | Verification & Integration | 5–8 | **In Progress** |
| 4 | Internal Deployment | 8–14 | Not Started |
| 5 | Multi-Tenant Architecture | 14–20 | Not Started |
| 6 | Full Deployment & Marketplace | 20–26 | Not Started |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Access to the Firebase project

### Local Development

```bash
# Clone the repository
git clone <repo-url>
cd parrish-dme-portal

# Install dependencies
npm install
cd functions && npm install && cd ..

# Start the development server
npm run dev
```

### Deploy

```bash
# Deploy hosting + functions
firebase deploy

# Deploy functions only
firebase deploy --only functions

# Deploy hosting only
firebase deploy --only hosting
```

### Environment Configuration

The Firebase project configuration is loaded from `src/services/firebaseService.ts`. For production deployments, ensure the Trigger Email Extension is configured in the Firebase Console with SMTP credentials for `notifications@harmonyhca.org`.

---

## Key Design Decisions

**Why Firebase over a custom backend?** A small team benefits from Firebase's managed auth, real-time database, and hosting. The BAA coverage for Firestore, Cloud Functions, and Cloud Storage satisfies HIPAA infrastructure requirements without dedicated DevOps.

**Why Zod for validation?** Shared schemas between client and server enforce a single source of truth for data integrity. The same schema that validates a DME form on the client rejects malformed data in the Cloud Function.

**Why Firestore-triggered functions over callable functions?** The org-level IAM policy (`constraints/iam.allowedPolicyMemberDomains`) blocked the Cloud Run invoker policy required for callable functions' CORS handling. Firestore-triggered functions use Eventarc instead of HTTP, sidestepping the issue entirely.

**Why Firebase Trigger Email instead of SendGrid?** Eliminates a third-party vendor relationship (and associated BAA), keeps email logic inside the Firebase ecosystem, and reduces API key management overhead.

---

## Documentation

Internal project documentation is maintained in the `guides/` directory:

- `HHCA DME Portal Project.md` — Original project plan (v1.0)
- `HHCA_DME_Portal_Project_Plan_v2.docx` — Current project plan (v2.0)
- `DME_Portal_Detailed_Progress_Report.docx` — Repository analysis and progress metrics
- `HHCA_DME_Portal_Phase3_Plan.md` — Phase 3 verification plan
- `Phase2_Progress_Report.md` — Phase 2 completion report
- `Invitation_Email_Implementation_Report.md` — Branded invitation email architecture

---

## License

Internal — Confidential. This software is proprietary to Parrish Health Systems of Ohio.
