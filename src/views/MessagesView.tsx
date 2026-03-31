import { useState, useEffect, useRef } from "react";
import { T } from "../tokens";
import Avatar from "../components/Avatar";
import Btn from "../components/Btn";
import Card from "../components/Card";
import Icon from "../components/Icon";
import Select from "../components/Select";
import EmptyState from "../components/EmptyState";
import Badge from "../components/Badge";
import { timeAgo, getInitials } from "../utils/formatting";
import { roleLabel } from "../utils/statusHelpers";
import { firebaseService } from "../services/firebaseService";
import type { Staff, Communication } from "../types";

const ROLE_COLORS: Record<string, string> = {
  admin:        T.accent,
  nurse:        T.info,
  homemaker:    T.warn,
  office_staff: T.purple,
};

// ─── Thread building ──────────────────────────────────────────────────────────

interface Thread {
  partner: Staff;
  lastMessage: Communication;
  unreadCount: number;
}

function buildThreads(userId: string, comms: Communication[], staff: Staff[]): Thread[] {
  const partnerIds = new Set<string>();
  comms.forEach((m) => {
    if (m.senderId === userId) partnerIds.add(m.recipientId);
    if (m.recipientId === userId) partnerIds.add(m.senderId);
  });

  const threads: Thread[] = [];
  partnerIds.forEach((partnerId) => {
    const partner = staff.find((s) => s.uid === partnerId);
    if (!partner) return;

    const threadComms = comms
      .filter(
        (m) =>
          (m.senderId === userId && m.recipientId === partnerId) ||
          (m.senderId === partnerId && m.recipientId === userId)
      )
      .sort((a, b) => a.createdAt - b.createdAt);

    const lastMessage = threadComms[threadComms.length - 1];
    if (!lastMessage) return;

    const unreadCount = threadComms.filter((m) => m.recipientId === userId && !m.read).length;
    threads.push({ partner, lastMessage, unreadCount });
  });

  return threads.sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt);
}

// ─── Thread list item ─────────────────────────────────────────────────────────

function ThreadItem({
  thread,
  active,
  onClick,
}: {
  thread: Thread;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = ROLE_COLORS[thread.partner.role] ?? T.accent;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 16px",
        background: active ? T.accentLight : hovered ? T.bgHover : "transparent",
        cursor: "pointer",
        transition: "background 0.1s",
        borderBottom: `1px solid ${T.borderLight}`,
        borderLeft: active ? `3px solid ${T.accent}` : "3px solid transparent",
      }}
    >
      <Avatar initials={getInitials(thread.partner.displayName)} color={color} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {thread.partner.displayName}
          </p>
          <span style={{ fontSize: 11, color: T.textLight, flexShrink: 0, marginLeft: 8 }}>
            {timeAgo(thread.lastMessage.createdAt)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="lock" size={10} color={T.textLight} />
          <p style={{ fontSize: 12, color: T.textLight, fontStyle: "italic" }}>Encrypted message</p>
        </div>
      </div>
      {thread.unreadCount > 0 && <Badge count={thread.unreadCount} />}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isFromMe,
  senderName,
  senderColor,
  senderInitials,
}: {
  message: Communication;
  isFromMe: boolean;
  senderName: string;
  senderColor: string;
  senderInitials: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isFromMe ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 8,
      }}
    >
      {!isFromMe && <Avatar initials={senderInitials} color={senderColor} size={30} />}
      <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isFromMe ? "flex-end" : "flex-start", gap: 3 }}>
        {!isFromMe && (
          <span style={{ fontSize: 11, color: T.textSub, paddingLeft: 2 }}>{senderName}</span>
        )}
        <div
          style={{
            padding: "10px 14px",
            borderRadius: isFromMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
            background: isFromMe ? T.accent : T.bgSub,
            color: isFromMe ? "#fff" : T.text,
            fontSize: 14,
            lineHeight: 1.55,
          }}
        >
          {message.messageBody}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: T.textLight }}>{timeAgo(message.createdAt)}</span>
          {message.ephemeral && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color: T.warn }}>
              <Icon name="clock" size={10} color={T.warn} />
              Disappears at end of day
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reply input ──────────────────────────────────────────────────────────────

function ReplyInput({
  currentUser,
  partnerId,
}: {
  currentUser: Staff;
  partnerId: string;
}) {
  const [body, setBody] = useState("");
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    if (!body.trim()) return;
    setSending(true);
    setError("");
    try {
      await firebaseService.sendMessage({
        senderId:    currentUser.uid,
        recipientId: partnerId,
        messageBody: body.trim(),
      });
      setBody("");
    } catch (err) {
      console.error("Message reply failed:", err);
      setError("Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      style={{
        padding: "12px 16px",
        borderTop: `1px solid ${T.borderLight}`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          rows={2}
          placeholder="Reply… (Enter to send, Shift+Enter for newline)"
          value={body}
          onChange={(e) => { setBody(e.target.value); setError(""); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            fontSize: 14,
            color: T.text,
            background: T.bgCard,
            border: `1px solid ${focused ? T.accent : T.border}`,
            borderRadius: T.radiusSm,
            padding: "9px 12px",
            outline: "none",
            fontFamily: T.font,
            resize: "none",
            lineHeight: 1.5,
            boxSizing: "border-box",
            transition: "border-color 0.12s",
          }}
        />
        <Btn variant="primary" size="sm" icon="messages" onClick={handleSend} disabled={sending || !body.trim()}>
          {sending ? "…" : "Send"}
        </Btn>
      </div>
      {error && <span style={{ fontSize: 11, color: T.urgent, fontWeight: 500 }}>{error}</span>}
    </div>
  );
}

// ─── Compose form ─────────────────────────────────────────────────────────────

function ComposeForm({
  currentUser,
  staff,
  onClose,
  onSent,
}: {
  currentUser: Staff;
  staff: Staff[];
  onClose: () => void;
  onSent: (partnerId: string) => void;
}) {
  const [recipientId, setRecipientId] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<{ recipient?: string; body?: string }>({});
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const recipients = staff.filter((s) => s.uid !== currentUser.uid);

  async function handleSend() {
    const e: typeof errors = {};
    if (!recipientId) e.recipient = "Please select a recipient.";
    if (!body.trim()) e.body = "Message cannot be empty.";
    if (Object.keys(e).length) { setErrors(e); return; }

    setSending(true);
    setSendError("");
    try {
      await firebaseService.sendMessage({
        senderId:    currentUser.uid,
        recipientId,
        messageBody: body.trim(),
      });
      onSent(recipientId);
      onClose();
    } catch (err) {
      console.error("Message send failed:", err);
      setSendError("Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: T.text }}>New Message</h3>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: T.textSub, display: "flex" }}
        >
          <Icon name="x" size={16} color={T.textSub} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Select
          label="To"
          required
          value={recipientId}
          onChange={(e) => { setRecipientId(e.target.value); setErrors((p) => ({ ...p, recipient: "" })); }}
          error={errors.recipient}
        >
          <option value="">Select recipient…</option>
          {recipients.map((s) => (
            <option key={s.uid} value={s.uid}>
              {s.displayName} — {roleLabel(s.role)}
            </option>
          ))}
        </Select>

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub, textTransform: "uppercase", letterSpacing: 0.3 }}>
            Message <span style={{ color: T.urgent }}>*</span>
          </label>
          <textarea
            rows={3}
            placeholder="Write your message…"
            value={body}
            onChange={(e) => { setBody(e.target.value); setErrors((p) => ({ ...p, body: "" })); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              width: "100%",
              fontSize: 14,
              color: T.text,
              background: T.bgCard,
              border: `1px solid ${errors.body ? T.urgent : focused ? T.accent : T.border}`,
              borderRadius: T.radiusSm,
              padding: "10px 12px",
              outline: "none",
              fontFamily: T.font,
              resize: "vertical",
              lineHeight: 1.5,
              boxSizing: "border-box",
              transition: "border-color 0.12s",
            }}
          />
          {errors.body && <span style={{ fontSize: 11, color: T.urgent, fontWeight: 500 }}>{errors.body}</span>}
        </div>

        {sendError && <span style={{ fontSize: 11, color: T.urgent, fontWeight: 500 }}>{sendError}</span>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" size="sm" icon="messages" onClick={handleSend} disabled={sending}>
            {sending ? "Sending…" : "Send"}
          </Btn>
        </div>
      </div>
    </Card>
  );
}

// ─── Messages view ────────────────────────────────────────────────────────────

interface MessagesViewProps {
  user: Staff;
  staff: Staff[];
  communications: Communication[];
}

export default function MessagesView({ user, staff, communications }: MessagesViewProps) {
  const [composing, setComposing] = useState(false);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [activeComms, setActiveComms] = useState<Communication[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const threads = buildThreads(user.uid, communications, staff);
  const activePartner = activePartnerId ? staff.find((s) => s.uid === activePartnerId) : null;

  // Subscribe to decrypted messages for the active thread
  useEffect(() => {
    if (!activePartnerId) { setActiveComms([]); return; }
    const unsub = firebaseService.subscribeToMessagesBetween(user.uid, activePartnerId, setActiveComms);
    return unsub;
  }, [user.uid, activePartnerId]);

  // Mark incoming messages as read when thread is opened
  useEffect(() => {
    if (!activePartnerId) return;
    communications
      .filter((c) => c.senderId === activePartnerId && c.recipientId === user.uid && !c.read)
      .forEach((c) => firebaseService.markMessageRead(c.id).catch(() => {}));
  }, [activePartnerId, communications, user.uid]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeComms]);

  return (
    <div style={{ display: "flex", gap: 20, maxWidth: 1000, height: "calc(100vh - 64px - 56px)", minHeight: 400 }}>

      {/* Left: thread list */}
      <div style={{ width: 300, minWidth: 300, display: "flex", flexDirection: "column" }}>
        {composing && (
          <ComposeForm
            currentUser={user}
            staff={staff}
            onClose={() => setComposing(false)}
            onSent={(partnerId) => setActivePartnerId(partnerId)}
          />
        )}

        <Card padding={0} style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px 12px",
              borderBottom: `1px solid ${T.borderLight}`,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Conversations</span>
            <Btn variant="secondary" size="sm" icon="plus" onClick={() => setComposing((c) => !c)}>
              New
            </Btn>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {threads.length === 0 ? (
              <EmptyState
                icon="messages"
                title="No conversations yet"
                subtitle="Start a conversation with a team member."
              />
            ) : (
              threads.map((t) => (
                <ThreadItem
                  key={t.partner.uid}
                  thread={t}
                  active={activePartnerId === t.partner.uid}
                  onClick={() => { setActivePartnerId(t.partner.uid); setComposing(false); }}
                />
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Right: active thread */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {activePartner ? (
          <Card padding={0} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Thread header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 20px",
                borderBottom: `1px solid ${T.borderLight}`,
                flexShrink: 0,
              }}
            >
              <Avatar
                initials={getInitials(activePartner.displayName)}
                color={ROLE_COLORS[activePartner.role] ?? T.accent}
                size={36}
              />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{activePartner.displayName}</p>
                <p style={{ fontSize: 12, color: T.textSub }}>{roleLabel(activePartner.role)}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="lock" size={12} color={T.textLight} />
                <span style={{ fontSize: 11, color: T.textLight }}>End-to-end encrypted</span>
              </div>
            </div>

            {/* Messages */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {activeComms.length === 0 ? (
                <EmptyState
                  icon="messages"
                  title="No messages yet"
                  subtitle="Send the first message below."
                />
              ) : (
                activeComms.map((m) => {
                  const isFromMe = m.senderId === user.uid;
                  const sender   = staff.find((s) => s.uid === m.senderId);
                  return (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      isFromMe={isFromMe}
                      senderName={sender?.displayName ?? "Unknown"}
                      senderColor={ROLE_COLORS[sender?.role ?? ""] ?? T.accent}
                      senderInitials={sender ? getInitials(sender.displayName) : "??"}
                    />
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input */}
            <ReplyInput currentUser={user} partnerId={activePartner.uid} />
          </Card>
        ) : (
          <Card style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <EmptyState
              icon="messages"
              title="Select a conversation"
              subtitle="Choose a thread on the left to read messages."
            />
          </Card>
        )}
      </div>
    </div>
  );
}
