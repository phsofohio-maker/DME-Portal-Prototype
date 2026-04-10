# SMTP Configuration Runbook — Trigger Email Extension

**Owner:** IT Lead
**Phase 3 exit criteria addressed:** #3 (email delivery), #5 (end-to-end smoke)
**Estimated time:** 30–45 minutes
**Prerequisites:** Firebase Console owner access for project `dme-portal-prototype`, mailbox credentials for `notifications@harmonyhca.org`

---

## Why this exists

The Cloud Functions in `functions/src/index.ts` (`onNewRequest`, `onRequestStatusChange`, `onNewMessage`, `onNewInvitation`) write to a Firestore collection called `mail`. Nothing in our codebase actually delivers email — that responsibility belongs to the Firebase **Trigger Email from Firestore** extension. Until the extension is installed and SMTP credentials are configured, every notification we generate is silently queued and never sent.

This runbook walks you through the one-time configuration. After it is complete, all four notification triggers will deliver real email.

---

## Step 1 — Install the extension

1. Open the [Firebase Console](https://console.firebase.google.com/) and select project **dme-portal-prototype**.
2. In the left nav, click **Extensions**.
3. Click **Explore extensions** and search for **Trigger Email from Firestore** (publisher: Firebase).
4. Click **Install in Firebase Console**.

---

## Step 2 — Configure the extension

When prompted, enter the following values **exactly**. Anything you type here is saved as a Cloud Secret — it is not committed to the repo.

| Field | Value |
| --- | --- |
| **Cloud Functions location** | `us-central1` (must match the rest of our functions) |
| **Authentication type** | `UsernamePassword` |
| **SMTP connection URI** | See "SMTP URI format" below |
| **SMTP password** | The password for `notifications@harmonyhca.org` (paste only — do not echo it back to anyone) |
| **Email documents collection** | `mail` |
| **Default FROM address** | `Parrish Health DME Portal <notifications@harmonyhca.org>` |
| **Default REPLY-TO address** | `notifications@harmonyhca.org` |
| **Users collection** *(leave blank)* | — |
| **Templates collection** *(leave blank)* | — |
| **Storage bucket** *(leave blank)* | — |
| **TTL expire type** | `day` |
| **TTL expire value** | `7` |

### SMTP URI format

The connection URI takes the shape:

```
smtps://USER:@HOST:PORT
```

The trailing colon-then-empty-password is intentional — the actual password is supplied separately as a Cloud Secret in the next field. For Google Workspace (the most common host for `@harmonyhca.org`):

```
smtps://notifications%40harmonyhca.org@smtp.gmail.com:465
```

Note the URL-encoded `@` (`%40`) inside the username. If the mailbox lives on a different provider, ask the IT lead for the correct host and port. For Microsoft 365 the host is `smtp.office365.com:587` and the scheme is `smtp://` (not `smtps://`).

If the mailbox uses 2FA (it should), generate an **app password** from the mailbox's account settings and use that as the password — your daily-use password will not work.

---

## Step 3 — Confirm the extension is healthy

1. After clicking **Install**, watch the deployment progress in the Firebase Console (it takes ~3 minutes).
2. When the status flips to **Healthy**, click into the extension and look at the **Logs** tab. You should see lines like `Started function ext-firestore-send-email-processQueue` with no errors.

If you see authentication errors, re-check the SMTP URI and password. The most common mistake is forgetting to URL-encode the `@` in the username.

---

## Step 4 — Redeploy the application functions

The extension and our own functions live in the same project, so once the extension is installed our triggers will write to the `mail` collection and the extension will pick up those documents automatically. Still, redeploy the functions in case anything in the runtime needs to be refreshed:

```bash
cd /path/to/dme-portal-prototype
firebase deploy --only functions --project dme-portal-prototype
```

You should see `✔ Deploy complete!` with no warnings about missing dependencies.

---

## Step 5 — Three-test smoke script

Run this **after** the extension is healthy. You will need a real test mailbox you can read (use your own work email — sign in to the portal with a test admin account so notifications go to you).

### Test A — Request submission notification

1. Sign in to the portal as a **nurse** test user.
2. Submit a new DME request (any equipment, any patient).
3. Within 60 seconds, the **admin** mailbox should receive an email titled **"New DME Request submitted by [Nurse Name]"**.
4. Open the email and visually verify it contains:
   - The submitter's name
   - A "Review Request" button linking to the portal
   - **Zero** clinical content (no ICD-10 codes, no diagnosis text, no drug names, no equipment SKUs)
   - The Parrish Health footer

### Test B — Status change notification

1. Sign in as an **admin**.
2. Open the request from Test A and click **Approve** (add a one-line note like "Approved on review").
3. Within 60 seconds, the original **nurse**'s mailbox should receive an email titled **"Your DME Request has been approved"**.
4. Visually verify:
   - Status word ("approved") in the body
   - Your admin note text appears under "Note from reviewer"
   - **Zero** clinical content
   - Footer

### Test C — New message notification

1. Sign in as a **nurse**.
2. Open **Messages** and send a new message to an admin (any plain text body).
3. Within 60 seconds, the **admin** mailbox should receive an email titled **"New message from [Nurse Name]"**.
4. Visually verify:
   - The body says "Log in to read and reply" (the actual message content is **never** included — it's encrypted at rest and can only be viewed in the portal)
   - **Zero** clinical content
   - Footer

If any of the three tests fails, **stop and escalate** — do not redeploy or change code. Capture screenshots of the failing email plus the extension logs from the Firebase Console.

---

## Step 6 — Sign-off

Once all three tests pass with real email delivery:

1. Append a row to `guides/Phase3_Verification_Report.md` under "Items Requiring Runtime / Manual Testing" stating the date, the IT lead's name, and "verified — three smoke tests passed."
2. Update the Phase 3 exit criteria table in `guides/HHCA_DME_Portal_Phase3_Plan.md` so criteria #3 and #5 read ✅.
3. Notify the architect (per the working agreement in the Phase 3 closeout handoff) so the Phase 3 closeout PR can move forward.

---

## Rollback — if email delivery goes wrong

If after rollout you discover the extension is sending bad emails (wrong content, leaked PHI, runaway loop, anything), disable it immediately:

1. Firebase Console → **Extensions** → click into "Trigger Email from Firestore"
2. Click **Manage** → **Uninstall extension**
3. Confirm uninstall.

This will stop the extension from picking up any new `mail` documents. Existing queued documents will remain in Firestore and can be inspected manually. Our application functions will continue writing to the `mail` collection (which is harmless — the documents just sit there until the extension is reinstalled).

After rollback, capture:
- Screenshot of the bad email(s)
- The contents of the offending `mail/{docId}` document
- The extension logs from the time of the incident

…and escalate to the architect before reinstalling.

---

## Reference: collections written by our functions

| Trigger | Source collection | Destination | Function file |
| --- | --- | --- | --- |
| `onNewRequest` | `requests` (create) | `mail` (one per active admin) | `functions/src/index.ts` |
| `onRequestStatusChange` | `requests` (update, status changed) | `mail` (one to submitter, if pref allows) | `functions/src/index.ts` |
| `onNewMessage` | `communications` (create) | `mail` (one to recipient, if pref allows) | `functions/src/index.ts` |
| `onNewInvitation` | `invitations` (create) | `mail` (one to invitee, with branded password reset link) | `functions/src/index.ts` |

All four functions write to the `mail` collection in the exact shape the Trigger Email extension expects: `{ to: string, message: { subject: string, html: string } }`.
