import { useState } from "react";
import { T } from "../tokens";
import Icon from "../components/Icon";
import Card from "../components/Card";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ: FaqItem[] = [
  {
    question: "How do I submit a DME request?",
    answer:
      `Navigate to New Request in the sidebar and select "DME Request." Choose the patient, then select the equipment needed from the catalog. Enter the ICD-10 diagnosis code using the search box — it connects to the NIH Clinical Tables database. Select urgency, add a clinical justification, and click Submit. The request will appear in your Requests list with a "Pending Review" status.`,
  },
  {
    question: "What is a Multi-Medication Batch request?",
    answer:
      `A Multi-Medication Batch lets you request up to 10 medications in a single submission. Instead of filing one request per drug, you add each medication as a row in the batch form, set the quantity and refills for each, and enter one shared pharmacy. This reduces admin review time and is preferred when a patient's entire monthly refill set is due at the same time.`,
  },
  {
    question: "How can I view a patient's full request history?",
    answer:
      `Open the Patients section from the sidebar and click on the patient's card. The Patient Detail page shows a complete Request History section at the bottom, listing every request submitted for that patient with status, type, and submission date. You can click any request to open the full detail view.`,
  },
  {
    question: "What happens after I submit a request?",
    answer:
      `Once submitted, your request enters a "Pending Review" status and is queued in the admin inbox. Kobe Reynolds (Admin) will review it and take one of three actions: Approve it, Deny it with a reason, or mark it as "Needs Info" (RMI) if additional clinical detail is required. You'll receive an in-app notification when a decision is made.`,
  },
  {
    question: `What does "Needs Info" (RMI) mean?`,
    answer:
      `RMI stands for Request More Information. When the admin marks a request as "Needs Info," it means the submission is incomplete or requires additional clinical documentation before it can be approved. The admin will include a note explaining what is needed. Review the note in the Request Detail view, gather the necessary information, and resubmit or update the request as directed.`,
  },
  {
    question: "How do I send a message to another staff member?",
    answer:
      `Click Messages in the sidebar. You'll see a list of your existing conversations. To start a new conversation, click the "New" button at the top of the conversation list, select a recipient from the dropdown (all active staff members are listed), type your message, and click Send. Unread messages appear with a green badge count on the Messages nav item.`,
  },
];

// ─── Accordion item ───────────────────────────────────────────────────────────

function AccordionItem({ item, open, onToggle }: { item: FaqItem; open: boolean; onToggle: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ borderBottom: `1px solid ${T.borderLight}` }}>
      <button
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "18px 20px",
          background: open ? T.accentLight + "60" : hovered ? T.bgHover : "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: T.font,
          textAlign: "left",
          gap: 16,
          transition: "background 0.12s",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: open ? T.accent : T.text, lineHeight: 1.4 }}>
          {item.question}
        </span>
        <span style={{ flexShrink: 0, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>
          <Icon name="chevron-down" size={16} color={open ? T.accent : T.textSub} />
        </span>
      </button>

      {open && (
        <div style={{ padding: "4px 20px 20px" }}>
          <p style={{ fontSize: 14, color: T.textSub, lineHeight: 1.7 }}>{item.answer}</p>
        </div>
      )}
    </div>
  );
}

// ─── Help view ────────────────────────────────────────────────────────────────

export default function HelpView() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  function toggle(i: number) {
    setOpenIdx((prev) => (prev === i ? null : i));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 740 }}>

      {/* Header */}
      <div>
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 400, color: T.text, marginBottom: 6 }}>
          Help Center
        </h2>
        <p style={{ fontSize: 14, color: T.textSub }}>
          Frequently asked questions about the Parrish Health DME Portal.
        </p>
      </div>

      {/* Quick links */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { icon: "dme" as const,      label: "DME Requests",    color: T.info   },
          { icon: "pill" as const,     label: "Medications",     color: T.accent },
          { icon: "pills" as const,    label: "Multi-Med Batch", color: T.purple },
          { icon: "patients" as const, label: "Patient Records", color: T.warn   },
          { icon: "messages" as const, label: "Messaging",       color: "#C4693A"},
        ].map(({ icon, label, color }) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              background: color + "18",
              borderRadius: 20,
              border: `1px solid ${color}28`,
            }}
          >
            <Icon name={icon} size={14} color={color} />
            <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
          </div>
        ))}
      </div>

      {/* FAQ accordion */}
      <Card padding={0}>
        {FAQ.map((item, i) => (
          <AccordionItem
            key={i}
            item={item}
            open={openIdx === i}
            onToggle={() => toggle(i)}
          />
        ))}
      </Card>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 20px",
          background: T.bgSub,
          borderRadius: T.radiusSm,
          border: `1px solid ${T.borderLight}`,
        }}
      >
        <Icon name="messages" size={18} color={T.textSub} />
        <p style={{ fontSize: 13, color: T.textSub }}>
          Still have questions? Message{" "}
          <strong style={{ color: T.text }}>Kobe Reynolds (Admin)</strong>{" "}
          directly through the messaging portal.
        </p>
      </div>
    </div>
  );
}
