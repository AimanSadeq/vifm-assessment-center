// Contact log (00237): channel names and row types, safe for client components.

export const CONTACT_CHANNELS = ["email", "phone", "whatsapp", "in_person", "client", "other"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];
export const CONTACT_CHANNEL_LABEL: Record<ContactChannel, string> = {
  email: "Email",
  phone: "Phone",
  whatsapp: "WhatsApp",
  in_person: "In person",
  client: "Via the client",
  other: "Other",
};

export type ContactKind = "email_invite" | "email_reminder" | "manual";

export type ContactHistoryRow = {
  id: string;
  email_norm: string;
  kind: ContactKind;
  channel: ContactChannel | null;
  note: string | null;
  ok: boolean;
  created_at: string;
  by: string | null;
};

