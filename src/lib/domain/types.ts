/**
 * ChairFill domain model.
 *
 * Times are stored as clinic-local calendar values: `date` is "YYYY-MM-DD" and
 * `startMin` is minutes after local midnight in the clinic's time zone. This keeps
 * the book stable regardless of the viewer's browser time zone.
 */

export type ISODate = string; // YYYY-MM-DD, clinic-local
export type Timestamp = number; // epoch ms

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
export type TimeBand = "morning" | "afternoon" | "evening";
export type Channel = "whatsapp" | "sms" | "email";

export type MarketCode = "IN" | "AU" | "UK" | "US";

export interface MarketConfig {
  code: MarketCode;
  label: string;
  locale: string;
  currency: string;
  timeZone: string;
  timeZoneLabel: string;
  /** Channels that are typical for this market, in order of preference. */
  channels: Channel[];
  privacyRegime: string;
  messagingRules: string;
}

export interface Location {
  id: string;
  name: string;
  area: string;
}

export type ProviderRole = "general" | "endodontist" | "prosthodontist" | "hygienist";

export interface Provider {
  id: string;
  name: string;
  shortName: string;
  role: ProviderRole;
  roleLabel: string;
  locationIds: string[];
}

export interface Chair {
  id: string;
  label: string;
  locationId: string;
  /** Provider scheduled on this chair by default. */
  providerId: string;
}

export type ServiceCategory = "preventive" | "restorative" | "endodontic" | "prosthetic" | "cosmetic" | "consult";

export interface AppointmentType {
  id: string;
  name: string;
  category: ServiceCategory;
  durationMin: number;
  /** Clinic-entered list price used for estimates only. Demo values. */
  estProduction: number;
  roles: ProviderRole[];
}

export interface DayHours {
  open: number; // minutes after midnight
  close: number;
  breakStart?: number;
  breakEnd?: number;
}

export interface ConsentRecord {
  whatsapp: boolean;
  sms: boolean;
  email: boolean;
  /** When the patient recorded this preference. */
  recordedAt: ISODate;
}

export interface Patient {
  id: string;
  name: string;
  firstName: string;
  phone: string; // synthetic, masked
  email: string; // synthetic
  language: "English" | "Hindi" | "Kannada" | "Tamil";
  consent: ConsentRecord;
  preferredChannel: Channel;
}

export type AppointmentStatus = "booked" | "completed" | "cancelled" | "no_show";
export type CancellationSource = "patient_call" | "patient_message" | "no_show" | "clinic";

export interface Appointment {
  id: string;
  patientId: string;
  typeId: string;
  providerId: string;
  chairId: string;
  locationId: string;
  date: ISODate;
  startMin: number;
  durationMin: number;
  status: AppointmentStatus;
  createdAt: Timestamp;
  /** Set when this appointment was booked into a recovered slot. */
  fromSlotId?: string;
  cancelledAt?: Timestamp;
  cancellationSource?: CancellationSource;
  cancellationNote?: string;
}

/**
 * Open chair-time. Created when ChairFill detects a cancellation, no-show,
 * reschedule, or a gap released by staff.
 */
export type SlotStatus =
  | "open" // detected, nothing sent yet
  | "offering" // a staff-approved campaign is live
  | "held" // reserved by staff, not offered
  | "filled" // booked with a waitlist patient
  | "closed" // staff chose to leave it empty
  | "lost"; // start time passed while unfilled

export type SlotOrigin = "cancellation" | "no_show" | "reschedule" | "released_gap";

export interface Slot {
  id: string;
  date: ISODate;
  startMin: number;
  durationMin: number;
  chairId: string;
  providerId: string;
  locationId: string;
  origin: SlotOrigin;
  /** The appointment whose cancellation opened this time. */
  sourceAppointmentId?: string;
  /** Treatment originally booked here; equipment and prep often match. */
  originalTypeId?: string;
  status: SlotStatus;
  detectedAt: Timestamp;
  resolvedAt?: Timestamp;
  filledAppointmentId?: string;
  heldNote?: string;
}

export type WaitlistStatus = "waiting" | "offered" | "booked" | "paused";

export interface WaitlistEntry {
  id: string;
  patientId: string;
  typeId: string;
  preferredProviderId: string | null;
  preferredLocationId: string | null;
  /** Empty array means any day. */
  preferredDays: Weekday[];
  /** Empty array means any time. */
  preferredTimes: TimeBand[];
  availableFrom: ISODate;
  /** Hours of notice the patient told us they need. */
  noticeHours: number;
  status: WaitlistStatus;
  addedAt: Timestamp;
  lastContactAt: Timestamp | null;
  /** Free-text preferences the patient selected or told the clinic. Non-clinical. */
  patientNotes: string;
  /**
   * Optional priority set by qualified clinic staff. Only scored when the clinic
   * explicitly enables staff priority in settings.
   */
  staffPriority?: { setBy: string; note: string };
}

export type OfferStatus =
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "contact_requested"
  | "superseded" // slot filled by someone else, or campaign stopped
  | "queued"; // cascade mode: waiting its turn

export interface Offer {
  id: string;
  campaignId: string;
  slotId: string;
  waitlistEntryId: string;
  patientId: string;
  channel: Channel;
  body: string;
  score: number;
  rank: number;
  status: OfferStatus;
  sentAt: Timestamp | null;
  expiresAt: Timestamp | null;
  respondedAt: Timestamp | null;
}

export type CampaignMode = "simultaneous" | "cascade";
export type CampaignStatus = "live" | "filled" | "exhausted" | "stopped";

export interface Campaign {
  id: string;
  slotId: string;
  mode: CampaignMode;
  offerWindowMin: number;
  approvedBy: string;
  createdAt: Timestamp;
  status: CampaignStatus;
  offerIds: string[];
}

export type MessageDirection = "outbound" | "inbound" | "system";

export interface MessageLog {
  id: string;
  patientId: string;
  offerId?: string;
  channel: Channel;
  direction: MessageDirection;
  body: string;
  at: Timestamp;
  /** Name of the provider adapter that "sent" it. Always simulated in demo. */
  provider: string;
}

export type ActivityKind =
  | "cancellation"
  | "slot_detected"
  | "campaign_launched"
  | "offer_sent"
  | "offer_accepted"
  | "offer_declined"
  | "offer_expired"
  | "contact_requested"
  | "slot_filled"
  | "slot_held"
  | "slot_released"
  | "slot_closed"
  | "slot_lost"
  | "rescheduled"
  | "manual_booking";

export interface ActivityEvent {
  id: string;
  at: Timestamp;
  kind: ActivityKind;
  slotId?: string;
  offerId?: string;
  text: string;
}

export type OtherFactor = "waitlist_seniority" | "staff_priority" | "none";

export interface MatchWeights {
  availability: number;
  time: number;
  service: number;
  dentist: number;
  location: number;
  other: number;
}

export interface ClinicSettings {
  weights: MatchWeights;
  otherFactor: OtherFactor;
  /** Must be explicitly enabled by qualified staff before staff priority is scored. */
  staffPriorityEnabled: boolean;
  minNoticeMin: number;
  offerWindowMin: number;
  defaultMode: CampaignMode;
  defaultBatchSize: number;
  autoBookOnAccept: boolean;
  maxOffersPerPatientPerWeek: number;
  cancellationPolicy: string;
  channels: Record<Channel, boolean>;
  quietHours: { start: number; end: number };
  messageTemplate: string;
}

export interface Clinic {
  id: string;
  name: string;
  city: string;
  market: MarketCode;
  locations: Location[];
  chairs: Chair[];
  providers: Provider[];
  appointmentTypes: AppointmentType[];
  /** Index by Weekday. null = closed. */
  hours: (DayHours | null)[];
  settings: ClinicSettings;
}

export interface DemoState {
  version: number;
  seededAt: Timestamp;
  /** Demo clock offset (fast-forward), in minutes. */
  clockOffsetMin: number;
  clinic: Clinic;
  patients: Patient[];
  appointments: Appointment[];
  slots: Slot[];
  waitlist: WaitlistEntry[];
  campaigns: Campaign[];
  offers: Offer[];
  messages: MessageLog[];
  activity: ActivityEvent[];
}
