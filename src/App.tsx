import { useEffect, useRef, useState } from "react";
import { T } from "./tokens";
import { onAuthChange, fetchStaffProfile, signOutUser } from "./services/authService";
import { firebaseService } from "./services/firebaseService";
import { patientService } from "./services/patientService";
import { ToastProvider } from "./components/Toast";
import { useIdleTimeout } from "./hooks/useIdleTimeout";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import IdleWarningModal from "./components/IdleWarningModal";
import LoginScreen from "./views/LoginScreen";
import DashboardView from "./views/DashboardView";
import PatientsView from "./views/PatientsView";
import PatientDetailView from "./views/PatientDetailView";
import RequestListView from "./views/RequestListView";
import RequestDetailView from "./views/RequestDetailView";
import NewRequestView from "./views/NewRequestView";
import MessagesView from "./views/MessagesView";
import TeamView from "./views/TeamView";
import HelpView from "./views/HelpView";
import SettingsView from "./views/SettingsView";
import AuditTrailView from "./views/AuditTrailView";
import type { Staff, Patient, Request, Communication, AppNotification, UserInvitation, ViewId } from "./types";

// ─── Placeholder view ─────────────────────────────────────────────────────────

function PlaceholderView({ name }: { name: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, padding: 40 }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: T.fontDisplay, fontSize: 28, color: T.textSub, marginBottom: 8 }}>{name}</p>
        <p style={{ fontSize: 14, color: T.textLight }}>Coming in a future block</p>
      </div>
    </div>
  );
}

// ─── Auth loading screen ──────────────────────────────────────────────────────

function AuthLoading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: T.bg }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
        </path>
      </svg>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}

function AppShell() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState<Staff | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await fetchStaffProfile(firebaseUser.uid);
        if (profile && profile.status === "suspended") {
          await signOutUser();
          setUser(null);
          setLoginError("Your account has been suspended. Please contact an administrator.");
        } else {
          setLoginError("");
          setUser(profile);
          firebaseService.recordLogin(firebaseUser.uid);
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────
  const [view, setView] = useState<ViewId>("dashboard");

  // ── Data — live Firestore subscriptions ───────────────────────────────────
  const [staff,          setStaff]          = useState<Staff[]>([]);
  const [requests,       setRequests]       = useState<Request[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [notifications,  setNotifications]  = useState<AppNotification[]>([]);
  const [invitations,    setInvitations]    = useState<UserInvitation[]>([]);
  const [patients,       setPatients]       = useState<Patient[]>([]);

  // Patients — load on sign-in (Firestore w/ static fallback when empty)
  useEffect(() => {
    if (!user) { setPatients([]); return; }
    patientService.listAll().then(setPatients);
  }, [user?.uid]);

  async function refreshPatients() {
    setPatients(await patientService.listAll());
  }

  // Staff list — loaded once per session (admin only for invite management)
  useEffect(() => {
    if (!user) { setStaff([]); return; }
    return firebaseService.subscribeToStaff(setStaff);
  }, [user?.uid]);

  useEffect(() => {
    if (!user) {
      setRequests([]);
      setCommunications([]);
      setNotifications([]);
      return;
    }
    const unsubReqs = user.role === "admin"
      ? firebaseService.subscribeToAllRequests(setRequests)
      : firebaseService.subscribeToUserRequests(user.uid, setRequests);
    const unsubComms  = firebaseService.subscribeToUserCommunications(user.uid, setCommunications);
    const unsubNotifs = firebaseService.subscribeToNotifications(user.uid, setNotifications);
    return () => { unsubReqs(); unsubComms(); unsubNotifs(); };
  }, [user?.uid, user?.role]);

  // ── Notification sound on new incoming notification ──────────────────────
  const lastNotifCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (!user) { lastNotifCountRef.current = null; return; }
    const prev = lastNotifCountRef.current;
    lastNotifCountRef.current = notifications.length;
    if (prev === null) return; // skip initial load
    if (notifications.length <= prev) return;
    if (user.notificationPrefs?.soundEnabled === false) return;
    playNotificationPing();
  }, [notifications.length, user?.uid, user?.notificationPrefs?.soundEnabled]);

  // Invitations — admin only (real-time)
  useEffect(() => {
    if (!user || user.role !== "admin") { setInvitations([]); return; }
    return firebaseService.subscribeToInvites(setInvitations);
  }, [user?.uid, user?.role]);

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [newRequestPatient, setNewRequestPatient] = useState<string>("");

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showNotifs, setShowNotifs] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function navigate(v: ViewId) {
    if (v === "new-request") setNewRequestPatient("");
    setView(v);
    setShowNotifs(false);
  }

  function openRequest(req: Request) {
    setSelectedRequest(req);
    setView("request-detail");
  }

  function openPatient(patient: Patient) {
    setSelectedPatient(patient);
    setView("patient-detail");
  }

  function newRequestForPatient(patientId: string) {
    setNewRequestPatient(patientId);
    setView("new-request");
  }

  async function logout() {
    await signOutUser();
    setUser(null);
    setView("dashboard");
    setSelectedRequest(null);
    setSelectedPatient(null);
    setNewRequestPatient("");
    setShowNotifs(false);
  }

  // ── HIPAA session timeout (15 min idle → auto-logoff) ─────────────────
  const { showWarning, remainingSeconds, stayLoggedIn } = useIdleTimeout({
    onTimeout: () => {
      firebaseService.logout();
      setUser(null);
      setView("dashboard");
      setSelectedRequest(null);
      setSelectedPatient(null);
      setNewRequestPatient("");
      setShowNotifs(false);
      setLoginError("You were logged out due to inactivity.");
    },
    enabled: !!user,
  });

  // ── Render gates ─────────────────────────────────────────────────────────
  if (authLoading) return <AuthLoading />;
  if (!user) return <LoginScreen externalError={loginError} />;

  // ── Authenticated shell ───────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: T.bg }}>
      {showWarning && (
        <IdleWarningModal
          remainingSeconds={remainingSeconds}
          onStay={stayLoggedIn}
          onLogout={logout}
        />
      )}
      <Sidebar
        user={user}
        view={view}
        onNavigate={navigate}
        requests={requests}
        unreadMessageCount={communications.filter((c) => c.recipientId === user.uid && !c.read).length}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <TopBar
          user={user}
          view={view}
          selectedPatient={selectedPatient}
          selectedRequest={selectedRequest}
          notifications={notifications}
          showNotifs={showNotifs}
          onToggleNotifs={() => setShowNotifs((s) => !s)}
          onCloseNotifs={() => setShowNotifs(false)}
          onLogout={logout}
        />

        <main style={{ flex: 1, overflowY: "auto", padding: 28, display: "flex", flexDirection: "column" }}>
          {renderView()}
        </main>
      </div>
    </div>
  );

  // ── View router ───────────────────────────────────────────────────────────
  function renderView() {
    switch (view) {
      case "dashboard":
        return (
          <DashboardView
            user={user!}
            requests={requests}
            patients={patients}
            staff={staff}
            onSelectRequest={openRequest}
            onNavigate={navigate}
          />
        );
      case "patients":
        return (
          <PatientsView
            user={user!}
            patients={patients}
            requests={requests}
            staff={staff}
            onSelectPatient={openPatient}
            onPatientAdded={refreshPatients}
          />
        );
      case "patient-detail":
        return selectedPatient ? (
          <PatientDetailView
            patient={selectedPatient}
            requests={requests}
            staff={staff}
            onBack={() => navigate("patients")}
            onNewRequest={newRequestForPatient}
            onSelectRequest={openRequest}
          />
        ) : (
          <PlaceholderView name="Patient Not Found" />
        );
      case "requests":
        return (
          <RequestListView
            user={user!}
            requests={requests}
            patients={patients}
            staff={staff}
            onSelectRequest={openRequest}
            onNewRequest={() => navigate("new-request")}
          />
        );
      case "request-detail": {
        const liveRequest = selectedRequest
          ? (requests.find((r) => r.id === selectedRequest.id) ?? selectedRequest)
          : null;
        return liveRequest ? (
          <RequestDetailView
            user={user!}
            request={liveRequest}
            patients={patients}
            staff={staff}
            onBack={() => navigate("requests")}
          />
        ) : (
          <PlaceholderView name="Request Not Found" />
        );
      }
      case "new-request":
        return (
          <NewRequestView
            user={user!}
            patients={patients}
            preselectedPatient={newRequestPatient}
            onDone={() => { setNewRequestPatient(""); navigate("requests"); }}
          />
        );
      case "messages":
        return (
          <MessagesView
            user={user!}
            staff={staff}
            communications={communications}
          />
        );
      case "team":
        return (
          <TeamView
            user={user!}
            staff={staff}
            invitations={invitations}
            onInvite={(email, role) => firebaseService.sendInvite(email, role, user!)}
            onSuspend={(uid) => firebaseService.deleteStaff(uid)}
            onReactivate={(uid) => firebaseService.reactivateStaff(uid)}
            onChangeRole={(uid, role) => firebaseService.updateStaff(uid, { role })}
            onRevokeInvite={(id) => firebaseService.revokeInvite(id)}
          />
        );
      case "audit":
        return user!.role === "admin"
          ? <AuditTrailView />
          : <PlaceholderView name="Not Authorized" />;
      case "help":
        return <HelpView />;
      case "settings":
        return (
          <SettingsView
            user={user!}
            onUpdateUser={(updates) => setUser((u) => u ? { ...u, ...updates } : null)}
          />
        );
      default:
        return <PlaceholderView name="Not Found" />;
    }
  }
}

// ─── Notification sound (Web Audio synthesis, no asset file) ─────────────────

function playNotificationPing(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.34);
    osc.onended = () => ctx.close();
  } catch {
    // Audio blocked by browser autoplay policy — silently no-op
  }
}
