# ChairFill

ChairFill fills cancelled dental appointments before the chair goes empty. It detects the freed chair-time, ranks the waitlist with a transparent, configurable score, lets a staff member approve an offer, simulates the patient's reply, books the slot, and reports recovered chair-hours and estimated production.

This is a **demo**. Every person, phone number and email is synthetic. Messages are simulated and nothing leaves the browser. The demo makes **no** compliance claim; see [docs/PRODUCTION.md](docs/PRODUCTION.md) for what a real deployment must add.

Initial market: India (INR, IST). Currency, time zone, channels and compliance copy come from market config, so Australia, the UK and the US can be added without touching the screens.

## Setup

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
```

Other commands:

```bash
npm test           # unit tests (vitest)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # production build
```

### Demo login

| Field | Value |
| --- | --- |
| Email | `frontdesk@tulsi.demo` |
| Password | `chairfill-demo` |

The sign-in is a demo gate stored in localStorage. It is not authentication.

## Data refreshes daily

The book is generated relative to today in the clinic's time zone, so the scenario is always live: a cancellation that just came in, an offer awaiting a reply, and two weeks of recovery history. Data refreshes when you open the app on a new day. **Reset demo data** (in the rail) restores the starting scenario at any time, and **Skip ahead 15 min** moves the demo clock so offers can lapse.

## The screens

| Route | What it does |
| --- | --- |
| `/` Today | Recovery strip, recovery-loop tracker, day book, ranked waitlist with score breakdown, offer composer, live offers, simulated patient phone |
| `/appointments` | A week of appointments and open chair-time. Filter by day, chair and status. Cancel, reschedule, reserve, release, fill or leave empty. `?appt=<id>` opens the reschedule form |
| `/waitlist` | Active entries and booked history. Add and edit entries, with consent and contact preference shown |
| `/campaigns` | Every campaign with its offers, statuses, approver, mode and reply times, plus an activity feed |
| `/analytics` | Cancellations, outcomes, recovered chair-hours, estimated production and reply times, each with a table view. A before and after illustration labelled as hypothetical |
| `/settings` | Hours, appointment types, waitlist rules, match weights, staff priority, channels, quiet hours, offer window, auto-book and the message template |

## First three manual tests

1. **See the match.** Sign in and land on Today. The tracker shows tomorrow 3 pm, Chair 2, cancelled by Rahul Mehta, detected and matched. Sneha Kulkarni ranks first (98). Expand her row to see the six weighted factors add up to the score.
2. **Fill the slot.** Review offer for 3 patients, then Approve and send, then Open phone on Sneha and tap Accept. The void fills as a restored block, the tracker completes, and Recovered chair-hours and Est. production rise in the strip.
3. **Cancel, reserve, expire.** Select any booked appointment later this week and Cancel appointment. A new hatched void appears and ranked candidates load. Try Reserve, then Release for filling. On the 11 am "Offer out" slot, use Skip ahead 15 min until the offer lapses and the slot reopens.

## Architecture

Layers, from the inside out, all under `src/lib`:

- **`domain/`** types, market config, and clinic-local time helpers. Times are stored as a calendar date plus minutes after local midnight in the clinic's time zone, so the book is stable whatever the viewer's browser time zone is.
- **`matching/engine.ts`** the transparent matching engine. Stage one is eligibility gates (treatment fits, consent on an enabled channel, notice, no double booking, weekly offer cap) and excluded patients are returned with the reason. Stage two is six weighted factors, each with a plain-language reason: `score = sum(weight x value) / sum(weights) x 100`. It never considers clinical urgency.
- **`ai/assistant.ts`** guarded text helpers. In the demo these are deterministic templates. They may draft offers and summarise stated preferences; they must not diagnose, advise on treatment, rank by urgency or state any time, dentist or price that was not given. Every draft passes `guardDraft` and staff approve every send.
- **`providers/`** interfaces for WhatsApp, SMS, email and practice-management software, with simulated adapters.
- **`demo/`** the synthetic seed, **pure actions** (`actions.ts`), metrics, selectors, and the zustand store.
- **`components/`** and **`app/`** the UI. Pages are client components inside the `(app)` shell and read the store through `useData()` and `useNow()`.

Rules that keep it honest:

- **Actions are pure.** Each takes the current state and returns a new one plus an optional error or notice. Nothing mutates its input. In production they become server mutations behind the same names.
- **A recovered booking is created in one place.** `bookIntoSlot` is the only code that creates a recovered appointment, and copy never claims a booking before it exists.
- **Repository seam.** The store persists through `DemoRepository` (`load`, `save`, `clear`). The demo implementation is localStorage; a Supabase implementation can replace it without touching the UI.

Metric definitions live at the top of `src/lib/demo/metrics.ts`. Fill rate is filled over filled plus lost, and slots staff chose to leave empty are excluded. Money figures are estimates from clinic-entered list prices, not collected revenue.

Design direction is in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md) ("The Viewbox": booked time is bright film, open time is a dark hatched void, amber means an offer is out, teal means time was recovered).

## Simulated integrations

| Integration | Demo behaviour |
| --- | --- |
| WhatsApp, SMS, email | Simulated adapters write to the in-app message log. The patient phone lets a person play the patient. Nothing is sent |
| Practice management software | Not connected. The book is the seeded data |
| AI drafting | Deterministic templates with the production guardrails already enforced |
| Sign-in | Fixed demo credentials |

## Future production integrations

- **WhatsApp Cloud API** with pre-approved message templates and recorded opt-in.
- **SMS** through a provider that supports TRAI DLT registration, with registered sender IDs and templates.
- **Email** through a transactional provider with consent and unsubscribe handling.
- **Practice management adapters** to read the book and write bookings back, behind the provider interfaces in `src/lib/providers`.
- **Supabase (PostgreSQL)** for storage, authentication and row-level security. A starting schema is in [docs/schema.sql](docs/schema.sql).

## Project docs

- [docs/PRODUCTION.md](docs/PRODUCTION.md) privacy and compliance requirements for a real deployment.
- [docs/schema.sql](docs/schema.sql) a Postgres schema mirroring `src/lib/domain/types.ts`.
