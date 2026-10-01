import type { MarketCode, MarketConfig } from "./types";

/**
 * Market configuration. India ships first; the others are placeholders so that
 * currency, time zone, channels and compliance copy never get hard-coded.
 * Regulatory names are pointers for production work, not compliance claims.
 */
export const MARKETS: Record<MarketCode, MarketConfig> = {
  IN: {
    code: "IN",
    label: "India",
    locale: "en-IN",
    currency: "INR",
    timeZone: "Asia/Kolkata",
    timeZoneLabel: "IST",
    channels: ["whatsapp", "sms", "email"],
    privacyRegime: "Digital Personal Data Protection Act, 2023",
    messagingRules: "TRAI TCCCPR (DLT registration) for SMS; WhatsApp Business opt-in",
  },
  AU: {
    code: "AU",
    label: "Australia",
    locale: "en-AU",
    currency: "AUD",
    timeZone: "Australia/Sydney",
    timeZoneLabel: "AEST",
    channels: ["sms", "email", "whatsapp"],
    privacyRegime: "Privacy Act 1988 (APPs)",
    messagingRules: "Spam Act 2003",
  },
  UK: {
    code: "UK",
    label: "United Kingdom",
    locale: "en-GB",
    currency: "GBP",
    timeZone: "Europe/London",
    timeZoneLabel: "UK time",
    channels: ["sms", "email", "whatsapp"],
    privacyRegime: "UK GDPR and Data Protection Act 2018",
    messagingRules: "PECR",
  },
  US: {
    code: "US",
    label: "United States",
    locale: "en-US",
    currency: "USD",
    timeZone: "America/New_York",
    timeZoneLabel: "ET",
    channels: ["sms", "email"],
    privacyRegime: "HIPAA (with BAAs for vendors)",
    messagingRules: "TCPA consent rules",
  },
};

export function money(market: MarketConfig, amount: number): string {
  return new Intl.NumberFormat(market.locale, {
    style: "currency",
    currency: market.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Compact money: ₹1.2L style for INR, $12.4k elsewhere. */
export function moneyCompact(market: MarketConfig, amount: number): string {
  if (market.currency === "INR") {
    if (amount >= 1_00_000) return `₹${trim(amount / 1_00_000)}L`;
    if (amount >= 1_000) return `₹${trim(amount / 1_000)}k`;
    return money(market, amount);
  }
  return new Intl.NumberFormat(market.locale, {
    style: "currency",
    currency: market.currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

function trim(n: number): string {
  return n.toFixed(n >= 10 ? 1 : 2).replace(/\.?0+$/, "");
}
