---
version: 1
slug: "src-app"
primary_target: "src/app"
related_targets: []
---

# Surface: ChairFill app (all authenticated routes)

Mode: Operate. Primary user: front-desk coordinator at an Indian private dental clinic, between calls. Task: see freed chair-time, pick who to offer it to, send, watch it fill. Secondary: practice manager reading recovery analytics and rules.

Memorable moment: the dark hatched void in the bright day-book that turns into a filled, "restored" block once the patient accepts.

Unresolved: none blocking. Market config is India first (INR), market-agnostic.

## Direction contract

THESIS: Chair-time is film on a lit viewbox. Booked time is dense and bright; a cancellation is a radiolucent void, dark and hatched, that ChairFill exists to fill. Refuses the category default of a white KPI-card dashboard with a teal calendar.

OWN-WORLD: Lit-panel ground (cool near-white #EEF3F5), film-mount chrome in deep film-blue (#12212B) for the nav rail, a single 9-step density ramp from radiolucent #0F1C24 to radiopaque #F7FAFB as the only tonal scale, safelight amber (#D98E2B) only for live offers awaiting reply, a restoration teal-white for filled slots. Open time is diagonally hatched (state never colour-only). Geist + Geist Mono for tabular times and money. Square-ish 6px radius, hairline mount borders, no cards-in-cards.

STORY: Visitor sees today's book, a void where a cancellation happened, its ranked waitlist with reasons, sends an offer, sees the simulated patient accept, the void fills, and the recovered chair-hours and estimated INR production tick up, labeled Estimate / Demo Data.

FIRST VIEWPORT: Left: dark film-mount nav rail. Top: a slim recovery strip (open now, offers out, filled today, recovered chair-hours, est. production) as tabular readouts, not cards. Main: the day book, chairs as columns on a visible 15-min grid, each column footed with booked/capacity minutes. Right: the focused void's panel with ranked candidates, score breakdown and the primary "Send offer" action. Selecting a void dims the rest of the book.

FORM: Viewbox (radiograph light panel and film mount), candidate 7 of 7 on the grounded list; seed key 0617e57b. Raises: one density ramp + hatch-as-state (exposure record), visible grid armature (Crouwel), running minutes vs capacity (j-card), focus dims the rest (streaming wall).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
