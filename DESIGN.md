---
name: ChairFill
description: Chair-time as film on a lit viewbox. Booked time is dense and bright, freed time is a dark hatched void waiting to be filled.
colors:
  d0: "#0f1c24"
  d1: "#192a33"
  d2: "#2a3d48"
  d3: "#435a67"
  d4: "#6a8393"
  d5: "#95abb8"
  d6: "#bfcfd8"
  d7: "#dde7ec"
  d8: "#f7fafb"
  panel: "#eaf0f3"
  panel-2: "#e0e8ec"
  surface: "#f7fafb"
  restored-film: "#fdfefe"
  ink: "#102029"
  ink-2: "#344b58"
  ink-3: "#536b79"
  on-dark: "#dde7ec"
  on-dark-2: "#9fb3bf"
  rule: "#cad7de"
  rule-strong: "#a7bac4"
  mount: "#0f1c24"
  mount-2: "#192a33"
  amber: "#d98e2b"
  amber-ink: "#8a520d"
  amber-wash: "#f6e7cf"
  restore: "#0d7565"
  restore-bright: "#2fb39b"
  restore-wash: "#dcf0eb"
  danger: "#b4372f"
  danger-wash: "#f6dfdc"
typography:
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "-0.02em"
    fontFeature: "\"ss01\", \"cv11\""
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
    fontFeature: "\"ss01\", \"cv11\""
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
    fontFeature: "\"ss01\", \"cv11\""
  body-sm:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.333
    fontFeature: "\"ss01\", \"cv11\""
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.333
  micro:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.25
  readout:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\""
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.333
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\""
rounded:
  control: "6px"
  block: "3px"
  cell: "1px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.d8}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.d2}"
  button-primary-disabled:
    backgroundColor: "{colors.d5}"
    textColor: "{colors.d7}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.d7}"
  button-ghost:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-danger-hover:
    backgroundColor: "{colors.danger-wash}"
  button-sm:
    padding: "0 12px"
    height: "32px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "36px"
  input-standalone:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "16px 20px"
  nav-item:
    textColor: "{colors.on-dark-2}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  nav-item-hover:
    backgroundColor: "{colors.mount-2}"
    textColor: "{colors.on-dark}"
  nav-item-active:
    backgroundColor: "{colors.d2}"
    textColor: "{colors.d8}"
  chip-live:
    backgroundColor: "{colors.amber-wash}"
    textColor: "{colors.amber-ink}"
    typography: "{typography.micro}"
    rounded: "{rounded.block}"
    padding: "0 6px"
    height: "20px"
  chip-recovered:
    backgroundColor: "{colors.restore-wash}"
    textColor: "{colors.restore}"
    typography: "{typography.micro}"
    rounded: "{rounded.block}"
    padding: "0 6px"
    height: "20px"
  chip-settled:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink-2}"
    typography: "{typography.micro}"
    rounded: "{rounded.block}"
    padding: "0 6px"
    height: "20px"
  demo-badge:
    backgroundColor: "{colors.amber-wash}"
    textColor: "{colors.amber-ink}"
    typography: "{typography.micro}"
    rounded: "{rounded.block}"
    padding: "2px 6px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.d8}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  toast-error:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.d8}"
---

# Design System: ChairFill

## Overview

**Creative North Star: "The Viewbox"**

ChairFill is a radiograph light panel with film clipped to it. The working ground is a cool, evenly lit panel; the navigation is the dark film-mount that holds it. Every piece of chair-time is a piece of film: booked time is dense and bright, and freed time is radiolucent, a dark void with a diagonal hatch. The product exists to turn voids back into film, so the most important thing on any screen is how much void there is and what is happening to it.

The system is an operate-mode tool for a front desk working between phone calls in daylight. It is light-only, dense, and tabular: readouts over cards, hairline rules over boxes, one tonal scale (the nine-step density ramp) over a decorative palette. Exactly two accents exist and both are semantic: safelight amber means an offer is out and waiting for a reply, and restoration teal means chair-time was recovered. Nothing else gets a hue. It is deliberately not a white KPI-card dashboard with a teal calendar.

State is carried by material, not by colour alone. Open time is hatched, held time is dotted and dashed, lost time is cross-hatched, recovered time has a crisp teal edge and a left bar. A coordinator should be able to read the book in greyscale.

**Key Characteristics:**
- One 9-step density ramp (d0 to d8) is the only tonal scale; dark means empty, bright means booked.
- Two semantic accents only: amber for live offers, teal for recovered time.
- Hatch, dot and cross-hatch patterns encode state alongside colour.
- Dark film-mount chrome (nav rail, mobile bar, phone sheet) around a lit panel ground.
- Tabular readouts in Geist Mono; prose and labels in Geist; sentence case throughout.
- Flat, hairline-ruled surfaces; shadow only for things that float.

## Colors

A cool blue-grey radiograph palette: one density ramp from near-black film-blue to lit white, plus two narrowly scoped accents.

### Primary
- **Film-Mount Blue-Black** (`mount`, = `d0`): the nav rail, mobile header, mobile menu sheet, patient phone body, login statement panel and the browser theme colour. The frame around the work, never the work itself.
- **Developer Ink** (`ink`): primary text, the primary button fill, the active day tab, selected-block ring, focus outline, "full fit" score cells and completed loop nodes. The strongest mark on the lit ground.

### Secondary
- **Safelight Amber** (`amber`, `amber-ink`, `amber-wash`): only for an offer that is out and awaiting a patient reply (the live void outline and pulse, "Offers sent" readout sub-line while replies are pending, "Awaiting reply" / "Asked for a call" chips, the current loop node during an offer, inline notes about offers in flight). The persistent "Demo data" badge also uses the amber wash and ink as a caution label. `amber-ink` carries text; raw `amber` is only ever a line, bar or outline.

### Tertiary
- **Restoration Teal** (`restore`, `restore-bright`, `restore-wash`): only for chair-time recovered by ChairFill (the restored film block's edge and left bar, "Recovered" and "Est. production" readouts, booked/counted loop nodes, the "Filled by ChairFill" panel band, "Accepted" chips, the recovery result cells, success toast check, the patient's own reply bubble and accept button in the phone, and the filled half of the brand mark). `restore-bright` is for marks on dark mount surfaces.

### Neutral
- **Density Ramp** (`d0` radiolucent through `d8` radiopaque): the only tonal scale. `d0`/`d1`/`d2` are void grounds and mount layers; `d3`/`d4` are mid-density marks (partial fit cells, selection highlight, rings on dark); `d5` is the disabled fill and scrollbar thumb; `d6`/`d7` are faint film and completed (past) film; `d8` is text on dark and the brightest film.
- **Lit Panel** (`panel`): the page ground behind everything. `panel-2` is the second neutral layer: hover fills, segmented-control trough, lunch/break band, skeletons, settled chips, the credentials box.
- **Film Surface** (`surface`): every container, input and booked block sits on this. `restored-film` is the one step brighter white used only inside restored blocks.
- **Ink steps** (`ink-2`, `ink-3`): secondary text (labels, sub-lines) and tertiary text (meta, units, captions, placeholders). `on-dark` and `on-dark-2` are their counterparts on mount and void.
- **Rules** (`rule`, `rule-strong`): `rule` is the hairline for container edges, row dividers and the hour grid; `rule-strong` outlines inputs, secondary buttons, empty fit cells and pending nodes.
- **Danger** (`danger`, `danger-wash`): errors and destructive actions only (error toast, form error text, danger button, blocking warnings). Never used for "lost" chair-time; lost time is a cross-hatched void.

### Named Rules
**The One Ramp Rule.** Every neutral, every chart series that is not amber or teal, and every density mark comes from d0 to d8 or the named neutrals aliased from it. No new greys, no new hues.

**The Safelight Rule.** Amber means "an offer is out and a patient has not answered yet" and nothing else (the Demo data label is the single standing exception). When the offer resolves, the amber goes away.

**The Recovery Rule.** Teal means time that ChairFill recovered. Do not use it for generic success, links, primary actions or branding beyond the mark.

**The Greyscale Test.** Every state must remain distinguishable with colour removed: hatch, dots, dashes, cross-hatch, edge bars and text labels carry it.

## Typography

**Body Font:** Geist (with ui-sans-serif, system-ui) with stylistic set `ss01` and `cv11` on.
**Mono Font:** Geist Mono (with ui-monospace), tabular numerals, -0.01em tracking.

**Character:** A plain, technical grotesk paired with its own mono. The sans does all the talking; the mono is an instrument readout, reserved for things you would measure.

### Hierarchy
- **Headline** (600, 1.5rem, -0.02em): one per view (page title "Today", the focused slot's time range, the focused patient's name). Never larger inside the app.
- **Title** (600, 0.875rem): section and panel headings ("Chair-time recovery", "Ranked waitlist", chair names, patient names in lists).
- **Body** (400, 0.875rem): definitions, panel copy, buttons (buttons are 500).
- **Body-sm** (400, 0.75rem): sub-lines, reasons, help text, legend, table cells.
- **Label** (500, 0.75rem): field labels, fieldset legends, readout labels sit at 400 in `ink-2`.
- **Micro** (500, 11px): chips, the Demo data badge, grid captions, column footer sub-lines.
- **Readout** (mono 500, 1.375rem, line-height 1): the recovery strip values. Candidate scores use mono 500 at 1.25rem.
- **Data** (mono 400, 0.75rem): clock times, durations, minute counts, money, scores, step numbers, relative times, credentials.

The login statement panel carries one larger sentence (600, 2.5rem, -0.03em) on the mount; it is a sign-in-only treatment, not an in-app heading level.

### Named Rules
**The Instrument Rule.** Geist Mono is for values only: times, durations, minutes, money, counts, scores, percentages. Never mono for labels, headings or prose. Always use the `.num` treatment (tabular figures) so columns align.

**The Sentence Case Rule.** No uppercase labels, no letter-spaced kickers or eyebrows above headings. A section is introduced by its title alone.

## Layout

- **Shell:** at `lg` (1024px) and up, a fixed 232px dark rail on the left (wordmark, six nav items, demo controls and clinic/session block pinned to the bottom) and a fluid main column. Below `lg`, the rail collapses into a 56px sticky mount bar with a menu button that opens a full-height mount sheet.
- **Page container:** max width 1600px, centred, padding 16px (mobile) / 24px (`sm`) / 32px (`lg`), vertical padding 20px / 28px. Major regions stack with a 20px gap.
- **Work + focus split:** on `lg` the main area is `content | focus panel` with the panel at 400px (440px at `xl`), sticky at top 24px and internally scrolling. Below `lg`, the focus panel moves above the content when something is selected and is hidden otherwise.
- **The book grid:** chairs are columns (min 140px each, after a 56px time gutter), grouped under location headers; one 15-minute row = 15px, with a stronger hairline every hour and a faint one every quarter-hour. Blocks inset 4px from column edges and 1px from row edges. The grid scrolls horizontally on small screens rather than squashing columns (min 640px).
- **Running totals:** every column of a time-based grid ends in a footer row of booked / capacity minutes plus open and lost minutes.
- **Readout strips:** metric strips are one ruled container split into equal cells by hairlines (2 columns mobile, 4 at `sm`, 8 at `xl`), never separate cards.
- **Rhythm:** 4px base. Panel sections pad 20px horizontally and 12 to 16px vertically; lists rows pad 12px vertically; inline gaps are 6 to 8px; form fields stack with 16 to 20px gaps.
- **Focus dims the rest:** when an item is selected, its siblings in the same view drop to 60% opacity (restored on hover) and the selected item gets a 2px ink ring with a 2px surface offset.

### Named Rules
**The Armature Rule.** Time-based views show their grid. Gridlines are `rule` hairlines; the structure is visible, not implied.

## Elevation & Depth

Flat by default, with depth expressed by density and hairlines. Containers are `surface` on the `panel` ground with a 1px inset `rule` line, not a drop shadow. Film blocks use inset strokes. The void reads as depth by being dark, not by shadow.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 1px 2px rgb(15 28 36 / 0.08), 0 8px 24px -12px rgb(15 28 36 / 0.28)`): only for layers that float above the panel: toasts, the patient phone sheet, and the hover state of a booked film block.
- **Inset hairline** (`box-shadow: inset 0 0 0 1px var(--rule)`): the default edge for panels, strips, booked film and the book container.
- **Safelight pulse** (`0 0 0 3px rgb(217 142 43 / 0.25)` pulsing over 2.4s with the expo-out ease): only on a live offer void, only when motion is allowed.

### Named Rules
**The Lightbox Rule.** Nothing on the lit panel casts a shadow at rest. If it floats (toast, sheet, popover, dialog), use Lift; otherwise use a hairline.

## Shapes

Square-ish and quiet. Controls, containers, inputs, nav items and toasts use the control radius (6px). Film blocks, chips, the Demo data badge, loop nodes and the focus outline use the block radius (3px). Fit cells and tiny density marks use 1px; legend swatches are 14x10px at 2px. Borders are 1px hairlines; state outlines on film are 1.5px. Containers are never nested inside other bordered containers: inside a panel, structure comes from hairline dividers and tinted wash blocks (amber note, restore result cells, `panel-2` troughs).

The patient phone is a simulated device and keeps device-like radii (18px body, 12px bubbles, 10px buttons, round avatar); those radii belong to the phone mock only and must not be used for app UI.

## Components

### Buttons
Calm, low-ornament controls that depress 1px on press.
- **Shape:** control radius (6px). Heights 40px (`md`, 16px side padding, 14px text) and 32px (`sm`, 12px padding, 13px text); full-width standalone form submits are 44px. Weight 500 (primary submit on login is 600). Icon gap 8px (6px small).
- **Primary:** `ink` fill, `d8` text; hover `d2`; disabled `d5` fill with `d7` text. One primary per region (e.g. "Review offer", "Send offer", "Sign in").
- **Secondary (default):** `surface` fill with a 1px inset `rule-strong` stroke; hover `d7`.
- **Ghost:** no fill, `ink-2` text; hover `panel-2` fill and `ink` text. Used for "Leave empty", "Keep", tertiary links styled as buttons.
- **Danger:** `surface` fill, `danger` text, `rule-strong` stroke; hover `danger-wash`.
- **On mount:** rail actions are ghost-like rows (`on-dark-2` text, hover `mount-2` fill, `on-dark` text). A confirm action on the mount inverts to a `d8` fill with `ink` text.
- **Focus:** global 2px `ink` outline at 2px offset (switches to `d7` on mount and void surfaces). Transitions: background, colour and transform at 150ms.

### Chips (status)
- **Style:** 20px tall, block radius (3px), 6px padding, micro type (11px, 500), always a text label.
- **Live (awaiting reply, asked for a call):** `amber-wash` fill, `amber-ink` text, 1px inset `amber` stroke.
- **Recovered / accepted:** `restore-wash` fill, `restore` text, 1px inset `restore` stroke.
- **Settled (declined, expired, closed):** `panel-2` fill, `ink-2` text (closed uses `ink-3`), no stroke.
- **Queued / not yet active:** `surface` fill, `ink-2` text, 1px inset `rule-strong` stroke.
- **Demo data badge:** `amber-wash` fill, `amber-ink` text, 60% amber border, block radius. Present on every screen that shows data.

### Cards / Containers (panels)
- **Corner Style:** control radius (6px).
- **Background:** `surface` on the `panel` ground.
- **Shadow Strategy:** inset 1px `rule` hairline (see Elevation); never Lift at rest.
- **Internal structure:** a header row (title left, `ink-3` caption right, bottom hairline, 10 to 16px vertical / 16 to 20px horizontal padding), then content divided by hairlines. Sticky action footers sit on `surface` with a top hairline.
- **Inline notes:** wash blocks inside panels with control radius and 12px padding: `amber-wash`/`amber-ink` for offer-in-flight notes, `danger-wash`/`danger` for blocking warnings, `restore-wash` cells for recovered results.

### Inputs / Fields
- **Style:** `surface` fill, 1px `rule-strong` border, control radius, `ink` text, `ink-3` placeholder. In-panel fields and selects are 36px tall with 10px padding at 14px; standalone form fields are 44px with 12px padding at 16px. Textareas use the same border with 10px padding and relaxed line height.
- **Label:** above the field, 500 weight, `ink-2` at 12px in panels (14px `ink` on standalone forms), 6 to 8px gap.
- **Focus:** border shifts to `ink`, plus the global focus outline when keyboard-focused.
- **Error:** message in `danger` text below the field with `role="alert"`; containers do not turn red.
- **Checkbox:** native, 16px, ink accent colour.
- **Segmented choice:** a `panel-2` trough with 4px padding holding two or more options; the selected option is a `surface` tile with a 1px inset `rule-strong` stroke, bold label and `ink-3` sub-line.

### Navigation
- **Rail:** `mount` background, wordmark in `d8`, items 36px tall with 12px gap between 18px Phosphor icon and 14px label, control radius. Default `on-dark-2`; hover `mount-2` fill with `on-dark`; active `d2` fill, `d8` text, weight 500, icon switches to its `fill` weight, `aria-current="page"`.
- **Mobile:** 56px sticky mount bar with wordmark and a 40px menu button; the menu opens a full-height mount sheet holding the same nav, demo controls and session block.
- **Day / view tabs:** inline tabs on the panel ground, active tab `ink` fill with `d8` text, others `ink-2` with `panel-2` hover. Counts of open voids appear beside a tab as a small void swatch plus a mono number.
- **Icons:** Phosphor (`*Icon` exports), regular weight by default, bold for small status glyphs inside nodes and toasts, fill for the active nav item. Sizes 12 to 18px.

### Film Blocks (signature)
The vocabulary every time-based view must reuse. Blocks are absolutely positioned on the book grid at block radius (3px), 8px horizontal padding, title in 12 to 13px 500, sub-line 11px at 80% opacity, duration in mono.
- **Booked** (film): `surface`, `ink` text, 1px inset `rule`. Hover adds Lift.
- **Completed** (film-past): `d7`, `ink-2` text, 1px inset `rule`.
- **Open** (void): `d1` ground with a 135deg hatch (1px line every 7px at 11% `d7`), `on-dark` text. Hover brightens.
- **Offer out** (void-live): the open void with amber hatch at 28% and a 1.5px inset `amber` edge, pulsing when motion is allowed.
- **Reserved** (void-held): `d2` with a 6px dot grid and a 1.5px dashed `d5` outline inset 3px.
- **Lost / left empty** (void-lost): `d0` with a 45deg + 135deg cross-hatch, `on-dark-2` text.
- **Recovered** (restored): `restored-film` white, `ink` text, 1.5px inset `restore` edge plus a 4px `restore` bar on the left. A filled slot keeps the void underneath and draws the restored block over it, entering with a 0.9s expo-out reveal.
- **Breaks:** a `panel-2` band with an 11px `ink-3` label ("Lunch").
- **Selected:** 2px `ink` ring, 2px `surface` offset; siblings dim to 60%.
- **Legend:** every view that uses these states shows the legend (14x10px swatches using the same classes, `ink-2` 12px labels).

### Readout Strip
A single ruled panel titled at top-left with a provenance caption at top-right ("last 7 days", "estimate", "demo data"). Cells: `ink-2` 12px label, mono readout value, `ink-3` 12px sub-line. A cell about open time carries a 4px void bar on its left edge; a cell about offers sent keeps an ink value (it is a period total) and shows only its "awaiting reply" sub-line in `amber-ink`, and only while replies are pending; recovered time and recovered production use `restore` values. Values re-enter with a 0.5s fade-and-rise when they change.

### Score / Fit Cells
Explainable ranking is drawn with density: one 8x12px cell per factor at 1px radius, `ink` for full fit, `d4` for partial, `surface` with a `rule-strong` stroke for no fit. The score is a mono number to the right; expanding the row reveals a table of factor, weight and points with a plain-language reason under each factor and a ruled total row.

### Process Tracker
A horizontal sequence of 22px nodes at block radius joined by 1px lines. Done: `ink` fill with a bold check (recovery stages use `restore`). Current: `surface` with a 1.5px `ink` inset (amber wash and edge while an offer is out), `aria-current="step"`. Pending: `panel-2` with `rule-strong` stroke and a mono step number. Stopped: the lost void pattern with a bold X. Each node has a 13px title, an `ink-2` sub-line and a mono relative time.

### Toasts
Bottom-centre on mobile, bottom-right on desktop, max 28rem. `ink` fill (`danger` for errors), `d8` text, control radius, Lift shadow, 12/16px padding. Success uses a `restore-bright` check; info and warning use Phosphor glyphs. Enter: 12px rise with 0.22s expo-out; reduced motion swaps to opacity only.

### Extending to unbuilt screens
- **Tables (Appointments, Waitlist, Campaigns):** a single panel with a header row; column headers 12px 400 `ink-3`, left-aligned text and right-aligned mono numerics; rows divided by `rule` hairlines with 12px vertical padding, no zebra striping; selected rows `panel` at 70%; row status shown with the chips above, and any column that represents chair-time uses a film-block swatch. Ranking columns use fit cells plus a mono score.
- **Forms (Settings, rules):** panel sections with a title, in-panel fields at 36px, segmented choices for 2 to 4 options, a sticky footer holding one primary and optional ghost actions. Weight sliders and percentages show mono values.
- **Charts (Analytics):** draw on the book grid's armature (hairline gridlines in `rule`, mono 11px `ink-3` axis labels). Booked or baseline series use density steps (`d3` to `d6`); open or unfilled time uses the void hatch; lost time uses the cross-hatched void; recovered time uses `restore`; live or pending offers use `amber`. Comparison series step along the density ramp, never new hues. Every chart carries a legend, a provenance caption (period, Estimate, Demo data) and a tabular equivalent.

## Do's and Don'ts

### Do:
- **Do** draw open, held, lost, offered and recovered time with the film-block classes, so hatch, dots, dashes and edge bars carry state alongside colour.
- **Do** keep amber strictly for offers awaiting a reply and teal strictly for recovered time; let both disappear when the state ends.
- **Do** set every time, duration, minute count, money value, score and percentage in Geist Mono with tabular figures.
- **Do** label estimates and synthetic data where the number appears ("estimate", "Demo data"), and show the Demo data badge on every data screen.
- **Do** keep the grid armature visible on time-based views and foot each chair column with booked / capacity minutes.
- **Do** build metric rows as one ruled strip divided by hairlines, with a provenance caption in the header.
- **Do** use 6px for controls and containers, 3px for film blocks, chips and nodes.
- **Do** dim siblings to 60% and ring the selection in 2px ink when something is focused.
- **Do** respect reduced motion: no pulse, no rise, opacity-only transitions.

### Don't:
- **Don't** introduce a new hue for charts, categories, channels or roles; step the density ramp instead.
- **Don't** use red for lost or unfilled chair-time; danger is for errors and destructive actions.
- **Don't** put KPI values in separate shadowed cards, or nest a bordered container inside another.
- **Don't** add drop shadows to anything resting on the panel; Lift is for floating layers only.
- **Don't** add uppercase, letter-spaced kickers or eyebrows above headings.
- **Don't** use emoji or text glyphs as icons; use Phosphor `*Icon` components.
- **Don't** add a dark theme or tint the panel ground; the scene is front-desk daylight.
- **Don't** use mono for labels or prose, or a display size above 1.5rem inside the app.
- **Don't** borrow the patient phone's large radii or round avatars for app UI.
