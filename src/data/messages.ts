import type { Message } from "../types";

export const MESSAGES: Message[] = [
  {
    id: "m1",
    senderId: "s2",
    recipientId: "s1",
    body: "Hi Kobe — just wanted to flag that Eleanor Voss (MRN-00412) is due for her fall risk re-assessment this week. I'll schedule it for Thursday morning.",
    sentAt: "2026-03-16T08:22:00Z",
    read: false,
  },
  {
    id: "m2",
    senderId: "s1",
    recipientId: "s2",
    body: "Thanks Maria. Please also check in on her blood glucose log — it hasn't been updated in the portal since last Friday. Let me know if you need anything from my end.",
    sentAt: "2026-03-16T09:05:00Z",
    read: true,
  },
  {
    id: "m3",
    senderId: "s5",
    recipientId: "s1",
    body: "Kobe, I submitted the RMI response for Ruth Delacroix (r3) — attached the INR result from this morning (2.4). Should be good to approve now.",
    sentAt: "2026-03-16T11:30:00Z",
    read: false,
  },
];
