-- ChairFill: starting PostgreSQL / Supabase schema mirroring src/lib/domain/types.ts.
-- A sketch for production work, not a migration that has been run or reviewed.
-- Row-level security, audit triggers and encryption settings are listed at the end
-- as required follow-ups; see docs/PRODUCTION.md. No compliance claim is made.
--
-- Times are clinic-local: a calendar date plus minutes after local midnight in the
-- clinic's time zone, the same convention the app uses. Timestamps are timestamptz.

create extension if not exists pgcrypto;

create type market_code as enum ('IN', 'AU', 'UK', 'US');
create type channel as enum ('whatsapp', 'sms', 'email');
create type provider_role as enum ('general', 'endodontist', 'prosthodontist', 'hygienist');
create type service_category as enum ('preventive', 'restorative', 'endodontic', 'prosthetic', 'cosmetic', 'consult');
create type time_band as enum ('morning', 'afternoon', 'evening');
create type appointment_status as enum ('booked', 'completed', 'cancelled', 'no_show');
create type cancellation_source as enum ('patient_call', 'patient_message', 'no_show', 'clinic');
create type slot_status as enum ('open', 'offering', 'held', 'filled', 'closed', 'lost');
create type slot_origin as enum ('cancellation', 'no_show', 'reschedule', 'released_gap');
create type waitlist_status as enum ('waiting', 'offered', 'booked', 'paused');
create type offer_status as enum ('sent', 'accepted', 'declined', 'expired', 'contact_requested', 'superseded', 'queued');
create type campaign_mode as enum ('simultaneous', 'cascade');
create type campaign_status as enum ('live', 'filled', 'exhausted', 'stopped');
create type message_direction as enum ('outbound', 'inbound', 'system');
create type other_factor as enum ('waitlist_seniority', 'staff_priority', 'none');

-- ------------------------------------------------------------------ clinic

create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  market market_code not null,
  time_zone text not null,                     -- IANA, e.g. Asia/Kolkata
  created_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics on delete cascade,
  name text not null,
  area text not null
);

create table providers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics on delete cascade,
  name text not null,
  short_name text not null,
  role provider_role not null,
  role_label text not null
);

create table provider_locations (
  provider_id uuid not null references providers on delete cascade,
  location_id uuid not null references locations on delete cascade,
  primary key (provider_id, location_id)
);

create table chairs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations on delete cascade,
  label text not null,
  default_provider_id uuid references providers
);

create table appointment_types (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics on delete cascade,
  name text not null,
  category service_category not null,
  duration_min int not null check (duration_min >= 5),
  est_production numeric(12, 2) not null check (est_production >= 0), -- clinic list price, for estimates only
  roles provider_role[] not null
);

-- One row per weekday; a missing row means closed. weekday: 0 = Sunday.
create table opening_hours (
  clinic_id uuid not null references clinics on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  open_min int not null,
  close_min int not null,
  break_start_min int,
  break_end_min int,
  primary key (clinic_id, weekday),
  check (close_min > open_min),
  check ((break_start_min is null) = (break_end_min is null))
);

create table clinic_settings (
  clinic_id uuid primary key references clinics on delete cascade,
  weight_availability int not null default 30 check (weight_availability >= 0),
  weight_time int not null default 25 check (weight_time >= 0),
  weight_service int not null default 20 check (weight_service >= 0),
  weight_dentist int not null default 10 check (weight_dentist >= 0),
  weight_location int not null default 10 check (weight_location >= 0),
  weight_other int not null default 5 check (weight_other >= 0),
  other_factor other_factor not null default 'waitlist_seniority',
  staff_priority_enabled boolean not null default false,  -- switched on by qualified staff; audit every change
  min_notice_min int not null default 120 check (min_notice_min >= 0),
  offer_window_min int not null default 45 check (offer_window_min >= 5),
  default_mode campaign_mode not null default 'simultaneous',
  default_batch_size int not null default 3 check (default_batch_size >= 1),
  auto_book_on_accept boolean not null default true,
  max_offers_per_patient_per_week int not null default 3 check (max_offers_per_patient_per_week >= 1),
  cancellation_policy text not null default '',
  channel_whatsapp boolean not null default true,
  channel_sms boolean not null default true,
  channel_email boolean not null default true,
  quiet_start_min int not null default 1260,
  quiet_end_min int not null default 480,
  message_template text not null
);

-- ------------------------------------------------------------------ patients

create table patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics on delete cascade,
  name text not null,
  first_name text not null,
  phone text,          -- encrypt at rest; mask in lists
  email text,
  language text not null default 'English',
  preferred_channel channel not null default 'whatsapp',
  created_at timestamptz not null default now()
);

-- Consent is its own versioned record: who, what, when, how. Never edited in place.
create table consent_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients on delete cascade,
  channel channel not null,
  granted boolean not null,
  source text not null,                 -- for example: intake form, WhatsApp opt-in, front desk call
  notice_version text not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid                      -- staff user, null when the patient did it themselves
);
create index on consent_records (patient_id, channel, recorded_at desc);

-- ------------------------------------------------------------------ book

create table appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics on delete cascade,
  patient_id uuid not null references patients,
  type_id uuid not null references appointment_types,
  provider_id uuid not null references providers,
  chair_id uuid not null references chairs,
  location_id uuid not null references locations,
  date date not null,                   -- clinic-local
  start_min int not null,
  duration_min int not null check (duration_min >= 5),
  status appointment_status not null default 'booked',
  created_at timestamptz not null default now(),
  from_slot_id uuid,                    -- set when booked into a recovered slot (fk added below)
  cancelled_at timestamptz,
  cancellation_source cancellation_source,
  cancellation_note text
);
create index on appointments (clinic_id, date);

-- A chair cannot hold two booked appointments that overlap.
create extension if not exists btree_gist;
alter table appointments add constraint appointments_no_overlap exclude using gist (
  chair_id with =,
  date with =,
  int4range(start_min, start_min + duration_min) with &&
) where (status = 'booked');

create table slots (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics on delete cascade,
  date date not null,
  start_min int not null,
  duration_min int not null check (duration_min >= 5),
  chair_id uuid not null references chairs,
  provider_id uuid not null references providers,
  location_id uuid not null references locations,
  origin slot_origin not null,
  source_appointment_id uuid references appointments,
  original_type_id uuid references appointment_types,
  status slot_status not null default 'open',
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  filled_appointment_id uuid references appointments,
  held_note text
);
create index on slots (clinic_id, date, status);

alter table appointments add constraint appointments_from_slot_fk foreign key (from_slot_id) references slots;

-- ------------------------------------------------------------------ waitlist and offers

create table waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics on delete cascade,
  patient_id uuid not null references patients,
  type_id uuid not null references appointment_types,
  preferred_provider_id uuid references providers,
  preferred_location_id uuid references locations,
  preferred_days smallint[] not null default '{}',   -- empty means any day
  preferred_times time_band[] not null default '{}', -- empty means any time
  available_from date not null,
  notice_hours int not null default 4 check (notice_hours >= 0),
  status waitlist_status not null default 'waiting',
  added_at timestamptz not null default now(),
  last_contact_at timestamptz,
  patient_notes text not null default '',            -- non-clinical only
  -- Set by qualified clinic staff; scored only when clinic_settings.staff_priority_enabled.
  staff_priority_set_by uuid,
  staff_priority_note text
);
create index on waitlist_entries (clinic_id, status);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references slots,
  mode campaign_mode not null,
  offer_window_min int not null check (offer_window_min >= 5),
  approved_by uuid not null,            -- staff user; every campaign is human-approved
  created_at timestamptz not null default now(),
  status campaign_status not null default 'live'
);

create table offers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns on delete cascade,
  slot_id uuid not null references slots,
  waitlist_entry_id uuid not null references waitlist_entries,
  patient_id uuid not null references patients,
  channel channel not null,
  body text not null,
  score int not null check (score between 0 and 100),
  rank int not null,
  status offer_status not null default 'queued',
  sent_at timestamptz,
  expires_at timestamptz,
  responded_at timestamptz
);
create index on offers (campaign_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients,
  offer_id uuid references offers,
  channel channel not null,
  direction message_direction not null,
  body text not null,
  at timestamptz not null default now(),
  provider text not null                -- adapter name; 'Simulated ...' in the demo
);

create table activity_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics on delete cascade,
  at timestamptz not null default now(),
  kind text not null,
  slot_id uuid references slots,
  offer_id uuid references offers,
  text text not null,
  actor uuid                            -- staff user who caused it, null for system events
);

-- ------------------------------------------------------------------ required follow-ups (not in this sketch)
--  * Row-level security on every table, scoped by clinic and role (front desk, manager, admin).
--  * An append-only audit log fed by triggers or the application, covering consent, settings,
--    staff priority, approvals, sends and exports.
--  * Encryption at rest for phone and email; key management; masked views for list screens.
--  * Retention jobs and a deletion path for data principal requests, including message logs.
--  * Booking must stay a single code path: only the book-into-slot mutation inserts an appointment
--    with from_slot_id, inside one transaction that also marks the slot filled.
