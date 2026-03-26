# Invitation Email Implementation Report

**Date:** March 25, 2026
**Project:** Parrish Health DME Portal
**Prepared for:** IT Lead
**Status:** In Progress — Blocked on Trigger Email Extension Configuration

---

## 1. Objective

Implement branded invitation emails for new staff members added to the DME Portal. Previously, the invitation flow sent Firebase's generic "Reset your password" email with no context about being invited. The goal is to send a professional, branded email that explains who invited them, their assigned role, and includes a one-click "Set Your Password" button.

---

## 2. Architecture Decisions

### Original Flow (Before)
1. Admin clicks "Send Invite" in Team view
2. Client creates Firebase Auth account via `createUserWithEmailAndPassword()` — **this signs the admin out** as a side effect
3. Client creates `staff` and `invitations` Firestore documents
4. Client calls `sendPasswordResetEmail()` — sends a generic Firebase password reset email

### New Flow (After)
1. Admin clicks "Send Invite" in Team view
2. Client writes a single document to the `invitations` Firestore collection (protected by admin-only Firestore rules)
3. `onNewInvitation` Cloud Function triggers on the new document and:
   - Creates the Firebase Auth account server-side via Admin SDK (no client sign-out side effect)
   - Creates the `staff` Firestore document
   - Generates a password-reset link via `getAuth().generatePasswordResetLink()`
   - Writes a branded HTML email to the `mail` Firestore collection
4. Firebase Trigger Email Extension picks up the `mail` document and delivers via SMTP

This approach keeps all sensitive operations server-side, prevents the admin session disruption, and produces a branded email consistent with the portal's other notification emails.

---

## 3. Code Changes Made

### File: `functions/src/index.ts`
- Added `getAuth` import from `firebase-admin/auth`
- Renamed all Cloud Functions to resolve trigger-type deployment conflicts:
  - `notifyNewRequest` → `onNewRequest`
  - `notifyRequestStatus` → `onRequestStatusChange`
  - `notifyNewMessage` → `onNewMessage`
- Added new `onNewInvitation` Firestore-triggered Cloud Function that:
  - Creates Auth account with random password
  - Handles "email already in use" gracefully (looks up existing account)
  - Creates `staff` document with role, notification preferences, and onboarding status
  - Generates password-reset link and writes branded invitation email to `mail` collection
  - Uses existing `emailWrapper()` and `emailFooter()` helpers for consistent branding
- Removed `createInvitation` callable function (replaced by Firestore-triggered approach due to CORS/IAM issues)

### File: `src/services/firebaseService.ts`
- Simplified `sendInvite()` to only write to the `invitations` collection
- Removed `createUserWithEmailAndPassword` and `sendPasswordResetEmail` imports (no longer needed client-side)

### File: `src/App.tsx`
- Updated `onInvite` callback to pass admin user to `sendInvite()`

### File: `src/views/TeamView.tsx`
- Improved error handling to display specific error messages in the UI and log to browser console

---

## 4. Deployment Issues Encountered

### 4.1 Trigger Type Conflict
**Error:** "Changing from an HTTPS function to a background triggered function is not allowed."

**Cause:** The original `notifyNewRequest`, `notifyRequestStatus`, and `notifyNewMessage` functions were previously deployed as HTTPS/callable functions. Firebase does not allow changing a function's trigger type in-place.

**Resolution:** Renamed all functions (`onNewRequest`, `onRequestStatusChange`, `onNewMessage`) so Firebase treats them as new functions. The old function names should be deleted from the Firebase Console.

### 4.2 Cloud Build Permission Failure
**Error:** "Build failed with status: FAILURE. Could not build the function due to a missing permission on the build service account."

**Cause:** Firebase Functions v2 uses Cloud Build with the default compute service account (`644527928557-compute@developer.gserviceaccount.com`), which lacked required build roles.

**Resolution:** Granted the following IAM roles to the compute service account:
```
roles/cloudbuild.builds.builder
roles/run.admin
roles/artifactregistry.writer
```

### 4.3 CORS / Cloud Run Invoker Policy (Callable Function Approach)
**Error:** "Access to fetch blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present."

**Cause:** The organization policy (`constraints/iam.allowedPolicyMemberDomains`) prevents granting `allUsers` or external principals the Cloud Run invoker role. Firebase v2 callable functions require this to handle CORS preflight OPTIONS requests.

**Attempted Resolutions:**
- `invoker: "private"` — blocked CORS preflight entirely
- `invoker: "public"` — blocked by org policy
- `cors: true` — org policy still prevented the invoker policy from being set

**Final Resolution:** Abandoned the callable function approach entirely. Switched to a Firestore-triggered function (`onDocumentCreated`) which does not require Cloud Run invoker policies since it is triggered by Eventarc, not HTTP requests.

### 4.4 Firebase Auth Permission
**Error:** "Credential implementation provided to initializeApp() via the 'credential' property has insufficient permission to access the requested resource."

**Cause:** The compute service account did not have permission to manage Firebase Authentication (create users, generate password reset links).

**Resolution:** Granted IAM role:
```
roles/firebaseauth.admin → 644527928557-compute@developer.gserviceaccount.com
```

### 4.5 Firestore Write Permission
**Error:** "7 PERMISSION_DENIED: Missing or insufficient permissions." (gRPC/Firestore WriteBatch.commit)

**Cause:** The compute service account could not write to Firestore from the Cloud Function (Admin SDK bypasses Firestore security rules but still requires IAM-level access).

**Resolution:** Granted IAM role:
```
roles/datastore.user → 644527928557-compute@developer.gserviceaccount.com
```

### 4.6 Eventarc Invocation Permission
**Error:** "The request was not authenticated. Either allow unauthenticated invocations or set the proper Authorization header."

**Cause:** Eventarc (which delivers Firestore events to Cloud Functions v2) could not invoke the Cloud Run service backing the function.

**Resolution:** Granted Cloud Run invoker directly to the compute service account on the specific service:
```
gcloud run services add-iam-policy-binding onnewinvitation \
  --member="serviceAccount:644527928557-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker"
```

---

## 5. Current Status

### Working
- Admin can send invitations from the Team view UI
- `onNewInvitation` Cloud Function triggers successfully on new invitation documents
- Firebase Auth account is created server-side
- `staff` Firestore document is created with correct role and preferences
- Branded HTML email is written to the `mail` Firestore collection
- Admin session is no longer disrupted when sending invitations

### Blocked
- **Trigger Email Extension is not delivering emails.** Documents appear in the `mail` collection but have no `delivery` state field, indicating the extension is not processing them.

### Action Required for IT
1. **Verify the Trigger Email Extension is installed** in Firebase Console → Extensions
2. **Confirm the extension is configured to watch the `mail` collection**
3. **Verify SMTP credentials** are configured for `notifications@harmonyhca.org` (host, port, username, password)
4. If the extension is not installed, install "Trigger Email from Firestore" from the Firebase Extensions marketplace and configure it with:
   - **Email documents collection:** `mail`
   - **Default FROM address:** `notifications@harmonyhca.org`
   - **SMTP connection URI:** (obtain from email provider)

Once the Trigger Email Extension is properly configured and processing `mail` documents, the full invitation email flow will be operational.

---

## 6. IAM Roles Summary

The following roles were granted to `644527928557-compute@developer.gserviceaccount.com` during this implementation:

| Role | Purpose |
|------|---------|
| `roles/cloudbuild.builds.builder` | Build Cloud Functions v2 |
| `roles/run.admin` | Manage Cloud Run services |
| `roles/artifactregistry.writer` | Push container images |
| `roles/firebaseauth.admin` | Create users, generate password links |
| `roles/datastore.user` | Read/write Firestore from Cloud Functions |
| `roles/run.invoker` (on onnewinvitation service) | Allow Eventarc to trigger the function |
