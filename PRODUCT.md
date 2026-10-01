# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + React + TypeScript + Tailwind CSS, as specified in the brief. Demo persistence is in-browser (seeded synthetic data in localStorage with a "Reset demo" control), behind a repository interface so Supabase/PostgreSQL can replace it later. No external API credentials required to run.

## Users

- **Primary:** front-desk coordinator at a private dental clinic. Works the appointment book in real time between phone calls and walk-ins. When a patient cancels, they need to see the freed chair-time, pick who to offer it to, and send the offer in seconds.
- **Secondary:** practice manager / clinic owner. Configures rules (hours, appointment types, notice periods, channels) and reads recovery analytics.

## Product Purpose

CHAIRFILL fills cancelled dental appointments before the chair goes empty. Empty chair-time is perishable inventory: dentist, staff, room and equipment are already scheduled. ChairFill detects newly opened slots, ranks waitlist patients with a transparent, configurable score, lets staff approve a fill campaign, simulates the patient offer and acceptance, books the slot, and reports recovered chair-hours and estimated production.

Success: within one minute a viewer understands cancellation → detected slot → matched waitlist → offer sent → patient accepted → slot filled → dashboard updated.

## Positioning

A dental chair-capacity recovery system. Not a CRM, not an AI receptionist, not a generic scheduler, not a medical system. The mechanism: perishable-slot detection + explainable waitlist ranking + staff-approved offers.

## Operating Context

- Initial market: **India** (INR, ₹; DPDP Act 2023; TRAI DLT rules for SMS; WhatsApp Business is the dominant patient channel). Architecture must stay market-agnostic so Australia, UK and US can be added via locale/market config.
- Used on a reception desktop, sometimes a tablet at the front desk, occasionally the manager's phone.
- Staff must approve every campaign and can manually select or deselect patients.

## Capabilities and Constraints

- Appointment actions: cancel, reschedule, fill slot, reserve, release.
- Matching weights (default): availability 30, time preference 25, service match 20, dentist preference 10, location 10, other configurable factor 5. Every match shows why.
- Messaging is simulated only. Never claim a booking occurred until the simulated booking action happens. No real SMS/WhatsApp/email sending.
- Provider interfaces (stubs) for WhatsApp, SMS, email, calendar/practice-management software.
- AI may draft messages, summarize preferences, categorize requests. AI must not diagnose, give treatment advice, invent availability, or prioritize by medical urgency unless explicitly configured by qualified clinic staff.
- No production-compliance claims.

## Evidence on Hand

None. All data is synthetic. No real customers, testimonials, logos, or results exist; the before/after comparison (12 cancelled: 4 vs 9 recovered) is hypothetical demo data and must be labeled as such. All financial metrics labeled "Demo Data" or "Estimate".

## Product Principles

1. The empty chair is the protagonist: every screen should make open chair-time and its recovery obvious.
2. Staff stay in control: the system proposes, a human approves.
3. Explain every ranking: no opaque scores.
4. Honest numbers: estimates are labeled, demo data is labeled, nothing is claimed that did not happen.
5. Speed at the desk: the common path (cancel → offer → fill) takes a few clicks.

## Accessibility & Inclusion

WCAG 2.2 AA target. Must work on desktop, tablet and mobile. Status must never rely on color alone.
