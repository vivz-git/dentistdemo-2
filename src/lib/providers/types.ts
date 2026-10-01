import type { Appointment, Channel, ISODate, Slot } from "@/lib/domain/types";

/**
 * Integration seams. The demo ships only simulated adapters; production adapters
 * implement the same interfaces server-side, where credentials live. Nothing in
 * the browser bundle may hold an API key.
 */

export interface OutboundMessage {
  channel: Channel;
  to: string;
  body: string;
  /** Idempotency key, so retries never double-send an offer. */
  dedupeKey: string;
  /** Provider template id where the channel requires pre-approved templates (WhatsApp, India DLT SMS). */
  templateId?: string;
}

export interface SendResult {
  ok: boolean;
  providerMessageId: string;
  provider: string;
  simulated: boolean;
  error?: string;
}

export interface MessagingProvider {
  readonly channel: Channel;
  readonly name: string;
  readonly simulated: boolean;
  send(message: OutboundMessage): Promise<SendResult>;
}

/** Inbound replies (button taps, keywords) normalised by a webhook handler. */
export interface InboundReply {
  channel: Channel;
  from: string;
  providerMessageId: string;
  intent: "accept" | "decline" | "contact" | "unknown";
  raw: string;
}

/**
 * Practice-management / calendar system. ChairFill reads the book, detects
 * freed time, and writes back a booking only after a patient accepts.
 */
export interface PracticeManagementProvider {
  readonly name: string;
  readonly simulated: boolean;
  listAppointments(from: ISODate, to: ISODate): Promise<Appointment[]>;
  /** Push-based systems call back; poll-based ones are diffed by the sync job. */
  onChange?(handler: (change: { kind: "cancelled" | "moved" | "created"; appointment: Appointment }) => void): () => void;
  book(slot: Slot, booking: { patientId: string; typeId: string }): Promise<{ appointmentId: string }>;
  hold?(slot: Slot, note: string): Promise<void>;
  release?(slot: Slot): Promise<void>;
}
