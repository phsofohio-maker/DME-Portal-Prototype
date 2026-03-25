import type { AppNotification } from "../types";

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    recipientId: "s1",
    title: "New DME Request",
    body: "James Okonkwo submitted a wheelchair request for James Whitfield.",
    createdAt: Date.parse("2026-03-16T09:14:00Z"),
    read: false,
    type: "new_request",
  },
  {
    id: "n2",
    recipientId: "s1",
    title: "New Message",
    body: "Maria Santos sent you a message about Eleanor Voss.",
    createdAt: Date.parse("2026-03-16T08:22:00Z"),
    read: false,
    type: "new_message",
  },
  {
    id: "n3",
    recipientId: "s1",
    title: "New Message",
    body: "James Okonkwo responded to the RMI on Ruth Delacroix's medication request.",
    createdAt: Date.parse("2026-03-16T11:30:00Z"),
    read: false,
    type: "new_message",
  },
  {
    id: "n4",
    recipientId: "s1",
    title: "New Medication Request",
    body: "Angela Watts submitted a Gabapentin refill request for James Whitfield.",
    createdAt: Date.parse("2026-03-09T15:50:00Z"),
    read: true,
    type: "new_request",
  },
];
