import type { Channel } from "@/lib/domain/types";
import type { MessagingProvider, OutboundMessage, SendResult } from "./types";

/**
 * Simulated adapters. They never touch the network. Each returns a fake
 * provider message id so the rest of the app behaves like it would in production.
 */
class SimulatedMessaging implements MessagingProvider {
  readonly simulated = true;
  constructor(
    readonly channel: Channel,
    readonly name: string,
  ) {}

  async send(message: OutboundMessage): Promise<SendResult> {
    return {
      ok: true,
      provider: this.name,
      simulated: true,
      providerMessageId: `sim_${this.channel}_${message.dedupeKey}`,
    };
  }
}

export const simulatedProviders: Record<Channel, MessagingProvider> = {
  whatsapp: new SimulatedMessaging("whatsapp", "Simulated WhatsApp"),
  sms: new SimulatedMessaging("sms", "Simulated SMS"),
  email: new SimulatedMessaging("email", "Simulated email"),
};

/*
 * Production adapters to implement later, server-side only:
 *   WhatsAppCloudProvider    Meta WhatsApp Business Cloud API, approved utility templates,
 *                            quick-reply buttons mapped to InboundReply.intent.
 *   DltSmsProvider           An Indian DLT-registered SMS gateway; registered header and
 *                            content template ids are mandatory.
 *   EmailProvider            Transactional email (e.g. SES, Postmark) with signed reply links.
 *   PmsProvider              Adapter per practice-management system; a sync job diffs the
 *                            book to detect cancellations where no webhook exists.
 */
