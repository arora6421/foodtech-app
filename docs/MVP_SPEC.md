# MVP Specification — Food Decision Engine

*Working title only. Status: **approved, revision 4 (2026-09-24). M0 closed**; see docs/m0-report.md. M1 planning: docs/m1-spec.md.*

Scope labels used throughout:

- **[NOW]** — in the MVP.
- **[DEFERRED]** — deliberately postponed; the architecture leaves room for it.
- **[NOT NEEDED]** — out of scope for the foreseeable product, not just the MVP.

---

## 1. Product principles

These are binding. When a design or engineering decision is unclear, resolve it against this list.

1. **It is a decision engine, not a feed.** There is no endless browsing anywhere in the product. Every screen moves the user towards one answer and one action.
2. **Every card is a question.** The swipe is only the interface for collecting preference information. The engine picks each card for what it will learn from the answer, not only because it thinks the user will like it.
3. **Budget: 8–12 swipes as standard, 15 hard maximum.** The engine actively tries to reach a confident answer as early as it honestly can. Target experience: *"I barely had to think and somehow it figured out what I wanted."*
4. **What before where.** The engine reasons about *dish archetypes* (what you want). *Offerings* (where you get it) are resolved afterwards and are replaceable.
5. **Taste lasts one session.** A craving describes tonight, not the person. A NOPE means *"not right now"*, not *"never"*. In the MVP no taste data outlives the session.
6. **Intent is not taste.** "Something new" and "I have no idea" change *how the engine explores*. They never write into the taste profile.
7. **Hard constraints are never traded off.** Diet filters are absolute and apply before any scoring. Nothing personalised can override them.
8. **Explanations must be honest.** Every explanation claim traces back to recorded evidence. Wording is limited by the amount of evidence ("both", "3 of 4", "every time"). With little evidence the product says so.
9. **Deterministic and inspectable.** The same inputs and seed always give the same deck, scores and result. Every score breaks down into named contributions.
10. **The engine has no dependencies.** It never imports React, Supabase, the network or the browser. It is pure TypeScript and runs in the UI, in tests, in simulations and later on a server.
11. **Groups: nobody miserable beats one person ecstatic.**
12. **Honest scope.** Mock data is labelled as mock, hand-offs are labelled as prototype, and a loader never fakes intelligence.

---

## 2. Exact MVP scope

### 2.1 Solo experience

| Feature | Scope | Notes |
|---|---|---|
| Welcome / mode select (Just me / With friends) | **NOW** | "With friends" is hidden until M2 |
| Craving picker: 7 moods, choose ≤ 2 | **NOW** | spicy, comforting, carby, fresh, indulgent, warm & soupy, sweet |
| Intents: "Something new", "No idea" | **NOW** | Change how the engine explores, never the taste profile (§7.6) |
| Diet hard filters: vegetarian, vegan, pescatarian, no pork, gluten-free | **NOW** | Saved on the device |
| Budget setting (Any / £ / ££ / £££) | **NOW** | Soft penalty plus a hard cap (§8) |
| Eating context (Delivery / Going out / Either) | **NOW** | Changes distance limits and venue eligibility |
| Allergen display, only when explicitly present in data | **NOW** | Never claims something is "safe" |
| Allergen filtering | **DEFERRED** | Needs data provenance and legal review first |
| Swipe gestures + buttons + keyboard | **NOW** | |
| Undo (repeatable) | **NOW** | Free, because sessions are event-sourced |
| "That's the one" on any card | **NOW** | Ends the session with that dish |
| "Decide for me" | **NOW** | Available at any point |
| Narrowing counter | **NOW** | A core UX element (§10.4) |
| Silent pivot on NOPE streaks | **NOW** | §10.3; happens inside the engine, no screen |
| "Tough crowd" interstitial | **NOT NEEDED** | Replaced by the silent pivot (rev. 2) |
| Match Found + explanation + confidence label | **NOW** | |
| 2 runner-up archetypes | **NOW** | Must be diverse (§10.5) |
| "Also at" (≤ 2 other venues for the same archetype) | **NOW** | Reinforces *what* before *where* |
| "Not quite" (one re-narrowing loop, then pick from 5) | **NOW** | Prevents an endless loop |
| Save + Saved list (on the device) | **NOW** | |
| Order / Directions hand-off sheets (UI states only) | **NOW** | Marked as prototype |
| Real delivery deep links / live maps | **DEFERRED** | |
| Share a match | **DEFERRED** | |
| Restore the in-progress session after a refresh | **NOW** | The event log is kept in `sessionStorage` |
| Meal-time eligibility rules (breakfast, dessert) | **NOW** | Simple rules (§8.2) |
| Opening hours | **DEFERRED** | A no-op eligibility hook exists |
| Real device location / postcode entry | **DEFERRED** | `LocationProvider` interface is NOW |
| Long-term taste profile / accounts | **DEFERRED** | |
| "Why nope?" reason chips | **DEFERRED** | Adds friction; revisit with data |
| AI-written explanation text | **DEFERRED** | Would only rephrase the structured reasons |
| Learned / ML ranking | **DEFERRED** | Built behind the `Scorer` contract |
| Dark theme | **DEFERRED** | Tokens make it cheap later |
| PWA install, offline | **DEFERRED** | |
| Native app | **DEFERRED** | Engine is portable |
| Search, menu browsing, restaurant pages, map view | **NOT NEEDED** | That is marketplace territory |
| Ratings, reviews, social feed, chat | **NOT NEEDED** | |
| In-app ordering / payments | **NOT NEEDED** | Hand-off only |
| Recipes / grocery / travel | **NOT NEEDED** | Future product lines |
| Internationalisation | **NOT NEEDED** | UK only |
| Admin CMS for the catalogue | **NOT NEEDED** | The catalogue lives in typed files |

### 2.2 Group experience (M2)

| Feature | Scope | Notes |
|---|---|---|
| Create session, join by code or link, anonymous, 2–6 members | **NOW** | |
| Setup per member in the lobby (name, diet, craving) | **NOW** | |
| 12-card deck: 6 shared cards + 6 personal cards | **NOW** | §12.3; the host writes the shared cards into the session |
| Joining after the host has started | **DEFERRED** | The pool and shared deck are fixed at Start |
| Deck that adapts to the whole group while people swipe | **DEFERRED** | Final round covers the gap |
| Waiting screen, host can "show results now" | **NOW** | |
| Aggregation, vetoes, common ground, result classification | **NOW** | §12 |
| Compromise (relax constraints, maximise the least-happy member) | **NOW** | |
| Final round (3 cards, approval vote) | **NOW** | |
| Presence indicators ("online") | **DEFERRED** | A status column is enough |
| Server-side result calculation / swipes hidden from other clients | **DEFERRED** | §19.5 |
| Budget per member | **DEFERRED** | The host sets context for the group |
| Host hand-over, session expiry clean-up job | **DEFERRED** | The `expires_at` column is NOW |
| Group chat, reactions | **NOT NEEDED** | |

### 2.3 Engine and tooling (M0)

| Feature | Scope |
|---|---|
| Taxonomy, schemas, mock catalogue with coverage validation | **NOW** |
| Features, evidence profile, scoring, belief, deck selection, stopping rule, shortlist, explanations | **NOW** |
| Pure group aggregation + in-memory group scenarios | **NOW** |
| Persona simulations, ablations, report CLI, simple parameter sweep | **NOW** |
| Developer debug panel | **NOW** |
| Local analytics sink | **NOW** |
| Remote analytics provider | **DEFERRED** |

---

## 3. User journeys

### 3.1 Solo: standard path (target ≤ 60 s, 8–12 swipes)

```
Open → "Just me"
 → Craving: taps "Spicy" + "Comforting" (settings remembered from last time)
 → Deck: ~3 probe cards (still within the craving, but deliberately varied)
 → ~5 narrowing cards, the narrowing counter falling
 → ~2 confirming cards
 → engine reaches confidence → Match Found
 → "Order" → hand-off sheet
```

### 3.2 Solo: shortcuts and recovery

| Situation | Behaviour |
|---|---|
| "That's the one" on card *n* | Match Found for that offering straight away. Stop reason `user_picked`. |
| "Decide for me" at card *n* | Shortlist from the current belief. The confidence label shows how much evidence there was. |
| "No idea" at craving | No craving priors, a longer probe phase (5 cards). Same budget. |
| "Something new" | Adventurousness prior plus more exploration slots. The final answer is still exploitative (§8.5). |
| 3 NOPEs in a row during Narrow | Silent pivot: no screen and no interruption. The next card is an anchor from a neighbouring cluster (§10.3). |
| "Not quite" on the match | The hero counts as a strong NOPE. Up to 5 more cards, then Match again. A second "Not quite" shows the top 5 to choose from. |
| Undo | Replays the event log without its last event. Can be repeated. |
| Refresh mid-session | Restored from the event log in `sessionStorage`. |

### 3.3 Group (M2)

```
Host: "With friends" → sets name, eating context, budget → lobby (code + share link)
Friends: open link (until the host starts) → name, diet, craving → lobby shows "ready"
Host: Start (requires ≥ 2 members, all ready)
Everyone: 12 cards (1–6 identical for all, 7–12 personal), progress shown ("7 of 12")
Waiting screen: who has finished; host may "Show results now"
Result:
  WINNER          → "WE HAVE A WINNER." → hand-off
  COMMON_GROUND   → pick + common-ground explanation; optional "Run a final round"
  NOBODY_AGREES   → "Okay, you lot are difficult." → compromise → final round (automatic)
Final round: 3 cards, each person approves any they'd accept → the most-approved dish wins → hand-off
```

---

## 4. Screen-by-screen specification

Shared rules: design mobile-first at 360–430 px width. Desktop shows the same layout in a centred phone-width column. Every screen has one primary action.

### S1 Welcome / Mode **[NOW]**
- **Purpose:** establish the personality; one-tap entry.
- **Content:** wordmark, a single line of voice ("Hungry? Don't know what for? Good."), a hero food image.
- **Actions:** `Just me` (primary), `With friends` (secondary, from M2), a Saved icon.
- **Analytics:** `app_opened`, `mode_selected`.

### S2 Craving & settings **[NOW]**
- **Moods:** 7 chips, choose up to 2. Picking a third replaces the oldest, with a gentle nudge.
- **Intents:** `Something new` (can be combined with moods) and `No idea` (clears moods; exclusive).
- **Settings row** (compact chips, remembered):
  - Diet: a sheet, multi-select from 5.
  - Budget: segmented Any / £ (≤ £10) / ££ (≤ £16) / £££ (≤ £25).
  - Eating: Delivery / Going out / Either.
- **Primary CTA:** "Figure me out" (copy to be finalised in M1). It is always enabled; nothing selected = `no_idea`.
- **Engine:** `startSession({ craving, settings, seed })`.
- **Edge case:** if the hard filters leave fewer than 8 eligible archetypes, show an inline warning before starting (§23).

### S3 Swipe deck **[NOW]**
- **Card anatomy:**
  - Image (4:5).
  - Offering name ("Seoul Fire Wings") with the archetype underneath ("Korean fried chicken").
  - Venue name, price, distance (plus walk time or delivery estimate).
  - A chilli level indicator.
  - 2–3 key tags (e.g. crispy · chicken · sweet-spicy).
  - Declared allergens behind a small "Allergens" affordance, only if present.
- **Top bar:** Undo, the narrowing counter ("142 dishes → 23 likely"), "Decide for me".
- **Bottom:** `NOPE` and `YES` buttons (icon + label, not colour alone), and a secondary `That's the one`.
- **Gesture:** a swipe commits past 30 % of the width or above a fling velocity. A YES/NOPE stamp appears as the card is dragged, and the card springs back below the threshold.
- **Adaptive prefetch:** when a card is shown, the engine pre-computes **both** possible next cards (after YES and after NOPE) and prefetches both images, so swipes never wait on the network.
- **No swipe counter in solo.** The narrowing counter *is* the progress indicator.
- **No interstitials.** NOPE streaks are handled by a silent pivot (§10.3). The swiping flow is never interrupted.

### S4 Match Found **[NOW]**
- **Entrance:** a short reveal transition (≤ 900 ms). It is choreography, not a fake loading screen.
- **Content:**
  - Label, e.g. "MATCH FOUND" or the confidence label (Strong match / Good match / Best guess).
  - The archetype name as the hero ("Korean fried chicken").
  - The offering line ("Seoul Fire Wings · Hanok House · £13.95 · 0.6 mi").
  - A headline ("We think you're craving something spicy, crispy and comforting.").
  - Up to 3 evidence-backed reasons, plus an optional "avoided" line.
- **"Also at":** up to 2 other venues for the same archetype.
- **Actions:** `Order` (primary when Delivery), `Directions` (primary when Going out; Either → Order primary), `Save`, `Not quite`.
- **Runners-up:** 2 compact cards. Tapping one promotes it to hero and regenerates the explanation for it.
- **Footer:** "Start over".

### S5 Order hand-off sheet **[NOW]**
- Platform choices as plain text, no logos. A "Prototype — not connected" marker.
- A success state: "In the real app, this would open [platform] at Hanok House."

### S6 Directions sheet **[NOW]**
- Fictional address, distance, walk time.
- An "Open in Maps" button that shows a prototype state instead of opening a real map. This avoids sending anyone to a real address for a fictional venue.

### S7 Saved **[NOW]**
- A list of saved matches: archetype, offering, venue, date.
- Tap for a detail view with the same actions as the match. Swipe or button to remove.

### S8 Empty states **[NOW]**
- "Filters too tight" and "Nothing left to show". There is no stall screen (§10.3). Details in §23.

### Group screens (M2) **[NOW in M2]**

| ID | Screen | Key contents |
|---|---|---|
| G1 | Create | Host name, eating context, budget → create |
| G2 | Lobby | Big code (unambiguous characters), share via Web Share API / copy link, member list with ready state, host Start (≥ 2 ready) |
| G3 | Join | Via `/g/:code`: name, diet, craving → ready |
| G4 | Group deck | As S3, but a fixed 12 cards, progress "7 of 12", `Love this` replaces `That's the one` (a super-YES) and there's no "Decide for me" |
| G5 | Waiting | Member statuses; host "Show results now" |
| G6 | Result | Three variants: WINNER / COMMON_GROUND / NOBODY_AGREES (copy in §11.6) |
| G7 | Final round | 3 cards shown together, tap to approve any; waiting; result |

### D1 Developer debug panel **[NOW, M0]**
- **Controls:** craving, settings, seed.
- **Swiping:** YES / NOPE / That's-the-one buttons on plain text cards.
- **Live views:**
  - The profile: feature preference and confidence bars, sorted, with the craving-prior part shown separately.
  - Belief top 10 with probabilities.
  - The chosen card: phase, slot type, EIG, score, and why it beat the runner-up card.
  - Stop-rule conditions A/B/C with current values.
  - Pivot state: NOPE streak, pivots used, flattening cards remaining, clusters (current, adjacent, anchor).
  - The narrowing counter, raw and displayed.
  - The explanation output with an evidence trace for each claim.
- **Replay:** load a persona simulation transcript and step through it.
- **In M1** it becomes an overlay (`?debug=1`).

---

## 5. Domain / data model

### 5.1 Entities

```ts
// ── WHAT ─────────────────────────────────────────────
interface DishArchetype {
  id: ArchetypeId                 // 'korean-fried-chicken'
  name: string                    // 'Korean fried chicken'
  cuisine: Cuisine                // family comes from a lookup table
  format: Format
  proteins: Protein[]             // [] if none
  flavours: Flavour[]             // 1–3
  textures: Texture[]             // 1–3
  moods: MoodTag[]                // curated; 'spicy' is never tagged (comes from the spice axis)
  mealType: MealType
  temperature: 'hot' | 'cold'
  axes: { spice: Level; richness: Level; adventurousness: Level }   // Level = 0|1|2|3|4
  keyIngredients: string[]        // display + explanations only
  dietary: DietaryFacts
  declaredAllergens?: Allergen[]  // UK 14; only shown if present
  image: ImageRef                 // default image for the archetype
}

// ── WHERE ────────────────────────────────────────────
interface Venue {
  id: VenueId
  name: string                    // fictional
  cuisine: Cuisine
  location: GeoPoint
  addressLine: string             // fictional
  offersDelivery: boolean
  dineIn: boolean
  handoff: HandoffTarget[]
  openingHours?: OpeningHours     // DEFERRED; hook exists
}

interface Offering {
  id: OfferingId
  venueId: VenueId
  archetypeId: ArchetypeId
  name: string                    // 'Seoul Fire Wings'
  description: string             // ≤ 140 chars
  pricePence: number              // integer; GBP
  image?: ImageRef                // falls back to the archetype image
  overrides?: {                   // rare; axes and dietary only
    axes?: Partial<Record<Axis, Level>>
    dietary?: Partial<DietaryFacts>
    declaredAllergens?: Allergen[]
  }
}

// ── Supporting types ─────────────────────────────────
interface DietaryFacts {
  vegetarian: boolean; vegan: boolean; pescatarianSafe: boolean
  containsPork: boolean; glutenFree: boolean
}
interface ImageRef { kind: 'generated' | 'licensed' | 'venue'; src: string; alt: string; credit?: string; dominantColour: string }
interface HandoffTarget { kind: 'delivery_platform' | 'maps'; label: string; url?: string }
interface GeoPoint { lat: number; lng: number }
```

### 5.2 Derived, runtime-only types

```ts
interface SessionContext {
  origin: GeoPoint               // from LocationProvider
  now: Date                      // injected, never read from the clock inside the engine
  fulfilment: 'delivery' | 'go_out' | 'either'
  budget: 'any' | 'low' | 'mid' | 'high'
  diet: DietConstraint[]
}
interface Candidate {            // an eligible offering, fully resolved
  offering: Offering; venue: Venue; archetype: DishArchetype
  features: FeatureVector        // archetype features merged with offering overrides
  distanceMiles: number; pricePence: number
}
interface CravingSelection { moods: Mood[]; intent: 'normal' | 'something_new' | 'no_idea' }
type Verdict = 'yes' | 'no' | 'super_yes'   // super_yes = "That's the one" (solo) / "Love this" (group)
interface SwipeEvent { cardIndex: number; archetypeId: ArchetypeId; offeringId: OfferingId; verdict: Verdict; at: number }
```

### 5.3 Validation rules (Zod + a catalogue test)

- **Dietary consistency:**
  - `vegan ⇒ vegetarian ⇒ pescatarianSafe`.
  - Meat proteins ⇒ `!pescatarianSafe`.
  - Fish or shellfish ⇒ `!vegetarian`.
  - `pork` ⇒ `containsPork`.
- Every archetype has ≥ 1 offering. Every offering references a valid venue and archetype.
- Every `ImageRef.alt` is non-empty. Every price is between 300 and 4000 pence.
- Offering overrides may only change axes by ±1 level.

---

## 6. Taxonomy

The taxonomy is a closed set of TypeScript union types and is **the contract** between data and engine. Changing it is a versioned change (`TAXONOMY_VERSION`).

| Dimension | Values |
|---|---|
| **Cuisine → Family** | east_asian: `japanese`, `korean`, `chinese` · southeast_asian: `thai`, `vietnamese` · south_asian: `indian` · middle_eastern: `lebanese`, `turkish` · mediterranean: `italian`, `greek`, `spanish` · british: `british` · north_american: `american` · latin_american: `mexican` · african_caribbean: `caribbean`, `west_african` (16 cuisines, 9 families) |
| **Format** | `noodles`, `rice`, `curry_stew`, `soup`, `burger`, `sandwich_wrap`, `pizza_flatbread`, `pasta`, `tacos_burrito`, `salad_bowl`, `dumplings_buns`, `protein_plate` (grilled, roasted or fried centrepiece), `small_plates`, `pie_bake`, `breakfast`, `dessert` |
| **Protein** | `chicken`, `beef`, `pork`, `lamb`, `fish`, `shellfish`, `tofu_tempeh`, `egg`, `legumes`, `cheese_dairy` |
| **Flavour** | `umami`, `tangy`, `sweet`, `smoky`, `herby`, `garlicky`, `cheesy`, `aromatic` (warm spices) |
| **Texture** | `crispy`, `crunchy`, `saucy`, `creamy`, `brothy`, `chewy` |
| **Mood tag (curated)** | `comforting`, `fresh`, `carby`, `indulgent`, `warm_soupy`, `sweet` |
| **Mood (user-facing)** | the tags above + `spicy` (mapped to the spice axis, never tagged) |
| **Meal type** | `main`, `light`, `breakfast`, `dessert` |
| **Temperature** | `hot`, `cold` |
| **Axes (0–4)** | `spice`, `richness`, `adventurousness` |
| **Diet constraint** | `vegetarian`, `vegan`, `pescatarian`, `no_pork`, `gluten_free` |
| **Allergen** | the UK 14 (display only) |

### 6.1 Labelling rubric (anchors; full rubric in `docs/labelling-rubric.md` during M0)

| Level | Spice | Richness | Adventurousness (for a typical London diner) |
|---|---|---|---|
| 0 | none (margherita, carbonara) | very light (summer rolls, sashimi) | universal (fish & chips, cheeseburger) |
| 1 | warmth (katsu curry, shawarma) | light (pho, poke) | familiar (tikka masala, pad thai) |
| 2 | medium (jalfrezi, gochujang glaze) | balanced (pad thai, burrito) | a step out (bibimbap, shakshuka) |
| 3 | hot (dan dan noodles, jerk chicken) | rich (tonkotsu, butter chicken) | less common (okonomiyaki, jollof with suya) |
| 4 | very hot (vindaloo, buldak) | very rich (mac & cheese, loaded fries) | unusual (egusi with pounded yam) |

**Mood tag curation rules:**
- `comforting` = hot, familiar and soothing (usually richness ≥ 2 or brothy).
- `fresh` = bright and light (richness ≤ 1, or raw / herby / tangy).
- `carby` = carbs lead the dish.
- `indulgent` = richness ≥ 3 and treat-like.
- `warm_soupy` = brothy or liquid stew, hot.
- `sweet` = dessert or a sweet-led dish.

Two labellers should agree within ±1 on every axis. The catalogue test flags `fresh` + richness ≥ 3, `indulgent` + richness ≤ 1, and `warm_soupy` + cold as errors.

---

## 7. Taste profile / evidence model

### 7.1 Feature representation

`featurize(archetype, overrides?) → FeatureVector` is the only way dish data reaches the engine. Feature IDs are namespaced strings:

```
cuisine:korean   family:east_asian   format:protein_plate   protein:chicken
flavour:sweet    texture:crispy      mood:comforting        temp:hot
spice:3          rich:3              adv:2
```

Axes are encoded as **level features** (`spice:0 … spice:4`), not as linear weights. This models ideal points and ceilings: someone can love `spice:3` and reject `spice:4`. It also reuses the same evidence mechanism everywhere.

**Salience** (the weight *s_f* of each feature in the vector):

| Namespace | Salience | Multi-valued split |
|---|---|---|
| cuisine | 1.0 | — |
| family | 0.5 | — |
| format | 1.0 | — |
| protein | 0.8 | ÷ √k |
| mood | 0.6 | ÷ √k |
| texture | 0.5 | ÷ √k |
| flavour | 0.35 | ÷ √k |
| temp | 0.4 | — |
| spice level | 0.9 | — |
| richness level | 0.5 | — |
| adventurousness level | 0.35 | — |

Here *k* is the number of values in that namespace, so a dish with three flavours doesn't get three times the flavour influence. All constants live in one `EngineConfig` object, which is passed in rather than global so simulations can sweep it.

### 7.2 Evidence per feature

```ts
interface Evidence {
  priorPos: number; priorNeg: number   // from craving / intent priors; never decayed
  swipePos: number; swipeNeg: number   // from swipes; recency-decayed (§7.3)
  yesSeen: number;  noSeen: number     // raw, undecayed counts of swiped cards with this exact feature
}
pos = priorPos + swipePos;   neg = priorNeg + swipeNeg
pref(f)       = (pos − neg) / (pos + neg + K)        K = 2      ∈ (−1, 1)
confidence(f) = (pos + neg) / (pos + neg + K)                   ∈ [0, 1)
```

Preferences shrink towards 0 until evidence builds up. The raw counts exist so explanations can make exact, honest claims.

### 7.3 Updates

**Recency decay (rev. 2).** Later swipes carry more weight than early probing swipes. When the *N*-th swipe has been recorded, swipe *t* carries weight

```
w_t = γ^(N − t)          γ = 0.92
```

- At 10 swipes, the first swipe carries 0.47 of its original weight. At 15 swipes, it carries 0.31.
- **Implementation (incremental and equivalent):** before a new swipe is applied, every feature's `swipePos` and `swipeNeg` are multiplied by γ. The new swipe is then added at weight 1.
- Priors are **never** decayed. Raw counts (`yesSeen` / `noSeen`) are **never** decayed.
- γ = 1.0 (no decay) is part of the M0 ablation, so the benefit is measured rather than assumed.

**YES:** for each feature *f*, `swipePos_f += η_yes · s_f`, with η_yes = 1.0. `super_yes` uses 1.5.

**NOPE: blame allocation (rev. 2).** Blame scales strictly with uncertainty × salience. There is no flat offset.

```
u_f          = 1 − confidence_f                        uncertainty, measured before this swipe
shielded_f   ⇔ pref_f > 0.5  and  noSeen_f = 0          (no earlier NOPEd card this session contained f)
raw_f        = shielded_f ? 0 : s_f · u_f
blame_f      = min( η_no · Σ_g s_g · raw_f / Σ_g raw_g ,  2 · η_no · s_f )        η_no = 0.6
swipeNeg_f  += blame_f
```

- **No uncertainty or no salience means no blame.**
- **A confidently liked feature (pref > 0.5) is shielded the first time.** Once it appears on a second NOPEd card in the session, the shield lifts and it's blamed by the same formula.
- **The cap** (at most 2× a feature's uniform share) stops one uncertain feature absorbing a whole NOPE when most of the others are shielded.
- **If every feature is shielded or certain** (Σ raw = 0), no feature is blamed. The archetype is still excluded (§7.4) and `noSeen` still increments.
- **Example:** a user who has said YES to chicken three times (pref ≈ 0.55) NOPEs a chicken salad. `protein:chicken` is shielded, and the blame falls on `format:salad_bowl`, `mood:fresh`, `rich:0` and other uncertain features.

**Level spill-over** keeps axis learning smooth:
- YES on level L: L gets 1.0, L ± 1 get 0.4.
- NOPE on spice level L: L 1.0, L+1 0.6, L+2 0.3. Spice rejection spills *upwards*: if 3 was too hot, so is 4.
- NOPE on richness or adventurousness: L 1.0, L ± 1 0.3.
- For a NOPE, the spill-over is scaled by the blame the exact level received. If the level was shielded or certain, nothing spills.
- Spill-over updates `swipePos` / `swipeNeg` only, never `yesSeen` / `noSeen`.

**"Not quite"** on a hero = a NOPE with η = 1.0 through the same blame rule, and that archetype is excluded.

**Known risk to measure in M0.11.** With pure uncertainty weighting, a feature that is already *confidently disliked* takes little further blame. For example, after two fish NOPEs, a third fish dish's NOPE moves mostly onto the dish's other, less certain features ("tacos", "Mexican"), which may be innocent. The simulations track this through feature recovery for P3/P8 and an innocent-feature blame metric (§14.3). If it shows up, the fallback is a config flag, **off by default**, that lets confidently negative features absorb blame first. Changing that default needs your sign-off.

### 7.4 Session exclusions

- NOPEd archetypes are excluded from the answer set for the rest of the session ("not right now").
- An archetype is never shown twice, whichever offering it came through.

### 7.5 Craving priors

A craving adds pseudo-evidence tagged `source: 'craving'`. Swipes can then override it. The strengths (+1.5, etc.) are deliberately small: about 1.5 swipes' worth.

| Mood | Priors |
|---|---|
| spicy | `spice:3` +1.5, `spice:4` +1.0, `spice:2` +0.5; `spice:0` neg +1.0 |
| comforting | `mood:comforting` +1.5, `temp:hot` +0.5 |
| carby | `mood:carby` +1.5 |
| fresh | `mood:fresh` +1.5, `rich:0`/`rich:1` +0.5; `rich:4` neg +0.5 |
| indulgent | `mood:indulgent` +1.5, `rich:3`/`rich:4` +0.5 |
| warm_soupy | `mood:warm_soupy` +1.5, `texture:brothy` +1.0, `temp:hot` +0.5 |
| sweet | `mood:sweet` +1.5, and dessert becomes eligible (§8.2) |

### 7.6 Intents (strategy, not taste)

| Intent | Effect | Writes taste? |
|---|---|---|
| `normal` | Default schedule | — |
| `something_new` | Exploration weight ×1.6; an adjacency slot every 3rd card from card 4; `adv:3` +1.0, `adv:4` +0.75, `adv:0` neg +0.5 (all tagged `source: 'intent'`, excluded from explanations as taste) | Only the tagged adventurousness prior, cleared at session end |
| `no_idea` | No priors; probe phase extends to 5 cards | No |

### 7.7 Persistence

The taste profile exists only in session memory, with the event log in `sessionStorage` for refresh recovery. **[NOW]** A long-term profile is **[DEFERRED]** (§20.6).

---

## 8. Recommendation scoring model

### 8.1 Pipeline

```
catalogue → hard eligibility (per offering) → eligible archetypes H
         → taste(a) → belief P(a) → finalRank(a) → shortlist
                                   ↘ deck selection (§9)
```

### 8.2 Hard eligibility (per offering; an archetype is eligible if ≥ 1 offering is)

1. **Diet:** every selected constraint must be satisfied:

   | Constraint | Condition |
   |---|---|
   | vegan | `vegan` |
   | vegetarian | `vegetarian` |
   | pescatarian | `pescatarianSafe` |
   | no_pork | `!containsPork` |
   | gluten_free | `glutenFree` |

2. **Fulfilment:**
   - `delivery` requires `offersDelivery`, max 4.0 mi.
   - `go_out` requires `dineIn`, max 1.5 mi.
   - `either` accepts either, max 3.0 mi.
3. **Budget cap:** price ≤ 1.3 × ceiling (£10 / £16 / £25).
4. **Meal type:**
   - `dessert` only if the `sweet` mood is selected.
   - `breakfast` only between 06:00 and 11:30 (from `context.now`).
   - `light` always.
5. **Opening hours:** hook present, always true. **[DEFERRED]**

These filters are invariants. A property-based test asserts that no filtered-out dish can ever appear on a card, in a shortlist or in a group result.

### 8.3 Taste score (the WHAT)

```
taste(a) = Σ_f s_f · pref(f) / Σ_f s_f            ∈ (−1, 1)
```

Dividing by total salience stops dishes with lots of tags from winning just because they have more features.

### 8.4 Belief over answers

```
P(a) ∝ exp(β · taste(a))      for a ∈ H (eligible, not NOPEd)        β = 20 (rev. 3; tuned in M0.13 from 6)
```

The belief is the engine's "what do they want?" distribution. It drives information gain, the stopping rule and the narrowing counter.

### 8.5 Final rank (WHAT + a little WHERE)

```
bestOffering(a) = argmax over eligible offerings o of a:
                  w_p · priceFit(o) + w_d · distanceFit(o) + tasteDelta(o)
                  (ties: lower price, then id)

finalRank(a) = taste(a) + w_p · priceFit(bestOffering(a)) + w_d · distanceFit(bestOffering(a))

priceFit(o)    = 0 if price ≤ ceiling, else −min(1, (price − ceiling) / (0.3 · ceiling));  0 if budget 'any'
distanceFit(o) = −(distance / maxDistance)²
w_p = 0.25;  w_d = 0.30 (go_out) / 0.20 (either) / 0.10 (delivery)
```

`tasteDelta(o)` is the taste difference caused by an offering's overrides. For example, if the user likes `spice:4`, the extra-hot version wins.

**The final ranking contains no exploration term.** An untested guess is never presented as "the match". "Something new" affects the result only through its adventurousness prior.

### 8.6 Score breakdown (contract)

```ts
interface ScoreBreakdown {
  archetypeId: ArchetypeId
  offeringId: OfferingId
  taste: number; priceFit: number; distanceFit: number; finalRank: number
  contributions: { featureId: FeatureId; salience: number; pref: number; confidence: number; value: number }[]
}
```

The debug panel, the explanations, group aggregation and tests all use this. Any future scorer must produce it.

### 8.7 Determinism

- Randomness comes only from a seeded generator (`mulberry32` or similar) that belongs to the session.
- All ties break by stable ID.
- The engine never reads the clock or any global state: `now` and `seed` are inputs.

---

## 9. Adaptive swipe / information-gain strategy

Choosing the next card is a different job from choosing the answer. The goal of each card is to learn as much as possible about the answer while still feeling relevant.

### 9.1 Expected information gain (EIG)

For each eligible, unseen archetype *c*:

```
p_yes(c) = clamp( Σ_a P(a) · sim(a, c)² , 0.05, 0.95 )       sim = cosine of base vectors   (rev. 3)
P⁺ = belief after hypothetically recording YES on c
P⁻ = belief after hypothetically recording NOPE on c
EIG(c) = H(P) − [ p_yes · H(P⁺) + (1 − p_yes) · H(P⁻) ]      H = Shannon entropy
```

- **Intuition:** early on, the best card splits the remaining possibilities roughly in half, like 20 Questions. Later, the best card confirms or rules out the leader.
- **Why p_yes comes from the belief (rev. 3):** the original σ(κ · taste(c)) is about 0.5 for every card early on. That makes *niche* cards look the most informative, because their hypothetical YES collapses the belief. In testing, a noodle lover was never shown a noodle dish in 15 cards. With the belief-predictive p_yes, a niche card only scores well if the belief already sits near it.
- **Cost:** O(|C| · 2 · |H| · F) ≈ 72 · 2 · 72 · 25 ≈ 260k operations, well within budget.
- **Performance budget:** `selectNext` ≤ 50 ms on a mid-range Android phone.
- **At real-data scale:** limit H to the top 100 archetypes by belief.

### 9.2 Card value by phase

`value(c) = λ_info · norm(EIG(c)) + λ_exploit · norm(finalRank(c)) − repetition(c)`, where `norm` is min–max normalisation over the current candidates.

| Phase | Default cards | λ_info | λ_exploit | Extra rules |
|---|---|---|---|---|
| **Probe** | 1–3 (1–5 for `no_idea`) | 0.85 | 0.15 | **Craving respect:** at least 2 of the first 3 cards must match a chosen mood, so the user feels heard |
| **Narrow** | 4–9 | 0.5 | 0.5 | Adjacency slots at cards 6 and 9 (every 3rd from card 4 for `something_new`) |
| **Confirm** | 10–15, or from card 6 when the top-3 belief mass ≥ 0.45 (rev. 3: not before card 6) | 0.2 | 0.8 | Tests the leaders directly |

With `something_new`, λ_info is multiplied by 1.6 and then renormalised.

### 9.3 Adjacency slots (controlled novelty)

This is the answer to the echo chamber.
- `L` = up to 3 liked features with pref ≥ 0.3 and confidence ≥ 0.3, ranked by pref × salience.
- An **adjacent** candidate shares ≥ 1 feature from `L`, and ≥ 2 of its cuisine / family / format / protein features have confidence < 0.25.
- The slot takes the adjacent candidate with the highest EIG. If there isn't one, the slot falls back to the normal rule.
- Example: someone into crispy chicken in a Korean style gets Nashville hot chicken or chicken karaage, not a random salad.

### 9.4 Repetition penalties

| Condition | Penalty |
|---|---|
| Same cuisine in the last 2 cards | −0.15 |
| Same format in the last 2 cards | −0.10 |
| Same venue in the last 3 cards | −0.10 |
| Archetype already shown | excluded |

### 9.5 Offering choice for a card

The card shows `bestOffering(c)`. Across the deck, a different venue is preferred when it's within 0.05 of the best.

### 9.6 Branch pre-computation

After card *n* is shown, the engine computes `selectNext` for both outcomes. The UI prefetches both images, and the reducer uses the cached result. Pre-computation is optional and never affects results.

### 9.7 Clusters and anchors (rev. 2; used by the silent pivot)

**Clusters.**
- When the catalogue loads, archetypes are grouped into **k ≈ 12 clusters** (13 on the mock catalogue, the smallest k that keeps every cluster within bounds) by deterministic k-medoids on the cosine distance between their base feature vectors.
- Algorithm: PAM, i.e. greedy BUILD then SWAP until no swap lowers total cost. Scans run in id order and only strict improvements are accepted, so ties break by id. (Farthest-point initialisation was tried first; it seeded clusters with outliers and produced incoherent groups.)
- The result is cached per catalogue version.
- A catalogue test checks that every cluster has 3–12 members.

**Fidelity.** An archetype's fidelity is its cosine similarity to its cluster's medoid, i.e. how textbook an example of that cluster it is.

**High-fidelity anchor.** For a given cluster, the anchor is the unseen, eligible member with the highest fidelity, with ties broken by EIG. It's a clear, recognisable example of the cluster (e.g. tonkotsu ramen for a noodle-soup cluster), so the user's reaction tells the engine something about the whole cluster.

**Current cluster.** The cluster containing the current `top` archetype.

**Adjacent clusters.**
- All other clusters, ranked by how similar their medoid is to the current cluster's medoid.
- **Cold** clusters are excluded: ≥ 2 NOPEs in this session and no YES, **or** a cluster whose pivot anchor was NOPEd (rev. 3; without this, the second pivot could re-anchor in the cluster the user had just rejected).

---

## 10. Stopping criteria

### 10.1 Rule (checked after every swipe; n = swipes so far)

Definitions:
- `top` = argmax of `finalRank` over H.
- `m3` = belief mass of the top 3 archetypes.
- **Support:** `taste(top) ≥ 0.15` (rev. 3; was 0.30) **and** the salience-weighted mean confidence of top's features ≥ 0.35.
- **Stable:** `top` was in the previous check's top 3, **or** in the same cluster as the previous top (rev. 3: a swap between equally good dishes of one kind, e.g. two noodle dishes, is not instability).
- **Cluster mass** (rev. 3): the belief mass on `top's` cluster. It may stand in for m3 (≥ 0.75 confident, ≥ 0.6 converged). It had no measurable effect in M0.13 and is kept only as an option.

| # | Condition | Stop reason |
|---|---|---|
| 1 | n ≥ 8 (rev. 3; was 6) **and** m3 ≥ 0.60 **and** support **and** stable | `confident` |
| 2 | n ≥ 10 **and** m3 ≥ 0.45 **and** support | `converged` |
| 3 | n ≥ 15 | `max_reached` |
| 4 | fewer than 2 unseen eligible archetypes left | `pool_exhausted` |
| — | "That's the one" | `user_picked` |
| — | "Decide for me" | `decide_for_me` |

All thresholds are **initial values**. M0 tunes them so the median stop lands at 8–12 swipes (§14.4).

### 10.2 Confidence label

| Label | When |
|---|---|
| Strong match | `confident`, or `user_picked` |
| Good match | `converged`, or `decide_for_me` with n ≥ 6 and support |
| Best guess | `max_reached`, `pool_exhausted`, `decide_for_me` without support |

### 10.3 Silent pivot (rev. 2; replaces the "Tough crowd" interstitial)

**Trigger.**
- 3 consecutive NOPEs on **Narrow-phase** cards.
- Probe-phase NOPEs are expected, useful information and don't count towards the streak.
- In the Confirm phase, the stopping rule handles it.

**Action.** This happens entirely inside the engine. There is no screen, no message and no break in the swiping.

1. **Lower the cluster threshold.** For the next 3 cards, the belief is flattened (β × 0.5). This widens the set of archetypes the deck treats as plausible beyond the current cluster, and it also delays the stopping rule.
2. **Inject an anchor.** The very next card is the high-fidelity anchor of the nearest adjacent, non-cold cluster (§9.7). If there isn't one, it's the highest-EIG card outside the current cluster.
3. **Soften the craving.** Remaining craving-prior evidence is halved. Three NOPEs in a row are evidence that the stated craving may be off (persona P7).
4. **Reset** the streak counter.

**Limits.**
- At most **2 pivots per session**.
- The swipe budget is unchanged. If the user is still saying NOPE at 15 swipes, the match is shown as "Best guess".

**The pivot never relaxes the user's own settings** (diet, budget, distance, eating context). Silently changing something the user chose would break principle 12. If the pool is genuinely too small, that shows up honestly as an S8 empty state or a `pool_exhausted` stop.

**Other effects.**
- The narrowing counter stays clamped, so flattening never makes the displayed number go up.
- The pivot is logged as `pivot_triggered` and shown in the debug panel.

### 10.4 Narrowing counter

- **Start value:** the number of eligible offerings.
- **After each swipe:** the number of offerings belonging to the smallest set of archetypes covering 90 % of the belief mass.
- **Display:** clamped so it never increases (a presentation choice; the raw value is logged).
- **Format:** "142 dishes → 23 likely".
- **Accessibility:** announced via `aria-live="polite"`.

### 10.5 Shortlist

- **Hero:** the top of `finalRank`. It may be an archetype the user said YES to or an unseen one, but never a NOPEd one.
- **Runners-up:** the next 2, each of which must differ from the hero and from each other in **format or family**. So Korean fried chicken followed by chicken karaage is rejected (same family and format).

### 10.6 "Not quite"

1. The hero counts as a strong NOPE and the budget is extended by 5 (a one-off).
2. The deck resumes in the Narrow phase. The rule is re-checked after at least 3 swipes.
3. A second "Not quite" shows the top 5 as a pick-list and ends the session.

---

## 11. Explanation system

### 11.1 Inputs and output

- **Inputs:** the hero's `ScoreBreakdown`, the profile evidence, the craving, the stop reason.
- **Output:**

```ts
interface Explanation {
  confidenceLabel: 'Strong match' | 'Good match' | 'Best guess'
  headline: string                                  // "We think you're craving something spicy, crispy and comforting."
  reasons: Reason[]                                 // ≤ 3
  avoided?: Reason                                  // ≤ 1
}
interface Reason { text: string; featureId: FeatureId; evidence: { yesSeen: number; noSeen: number; fromCraving: boolean } }
```

### 11.2 Selecting reasons

- **Candidates:** hero contributions with value > 0, pref ≥ 0.25 and confidence ≥ 0.35 from swipe evidence.
- A feature supported only by the craving can appear once, phrased as the user's statement: "You said you fancied something comforting."
- **Ranking:** by contribution. At most one reason per namespace.
- **Avoided:** the feature with the lowest pref (≤ −0.3, noSeen ≥ 2) that the hero doesn't have. Example: "…and you passed on both salads."

### 11.3 Quantifier rules (enforced in code and tests)

| Evidence | Allowed wording |
|---|---|
| yes = seen = 1 | Can't be a stand-alone reason; only "leaning towards …" |
| yes = seen = 2 | "both" |
| yes = seen ≥ 3 | "every time" / "all *n*" |
| yes/seen ≥ 0.66, seen ≥ 3 | "*yes* of *seen*" |
| "consistently" | only if seen ≥ 4 and yes/seen ≥ 0.75 |

### 11.4 Headline

- Take up to 3 features that have adjectives, with pref ≥ 0.25. Examples of the adjective map:
  - `texture:crispy` → crispy
  - `spice:3/4` → spicy / fiery
  - `rich:3/4` → rich
  - `rich:0/1` → light
  - `mood:comforting` → comforting
  - `flavour:smoky` → smoky
- Template: "We think you're craving something {a}, {b} and {c}."
- With fewer than 2 adjectives: "We think you're in the mood for {format/cuisine phrase}."

### 11.5 Special cases

| Case | Wording |
|---|---|
| `user_picked` | "Your call — and it fits: …" when evidence supports it, otherwise "Your call." |
| `decide_for_me` with little evidence | "Based on what you told us…" (craving-only reasons) |
| Group | "All 3 of you said yes to this." / "Everyone's up for Korean and something spicy." / "Sam ruled out seafood." |

### 11.6 Copy deck

- All user-facing strings live in `src/app/copy/`, in a UK voice, with a few variants per state picked deterministically from the seed.
- Group copy:
  - WINNER: "WE HAVE A WINNER."
  - NOBODY_AGREES: "Nobody agrees." then "Okay, you lot are difficult."
  - COMMON_GROUND: "Common ground found."
- **Tone rule:** playful towards the situation, never mocking a person.

### 11.7 Faithfulness test

- For every simulated session, each `Reason` must point to evidence that satisfies §11.3.
- A persona check measures how many reasons match the persona's *true* liked features (§14.3).

---

## 12. Group matching model

The same engine and taste function are used, with one profile per member. Aggregation is pure: `computeGroupResult(snapshot, catalogue, config) → GroupResult`.

### 12.1 Group pool

- Hard filters use the **union** of all members' diet constraints plus the host's context (fulfilment, budget).
- Everyone swipes only on dishes everyone can eat.

### 12.2 Per-member scores

- `s_i(a) = taste_i(a)` over the group pool.
- A member with fewer than 6 swipes when results are forced is left out of the aggregation and named in the result: "Sam didn't finish, so we went without them."

### 12.3 Group deck **[NOW]**

- **Cards 1–6: shared, written by the host (rev. 2).**
  - When the host taps Start (all members ready), the host's client runs `sharedGroupDeck(pool, seed, config)`: EIG over a *neutral* profile (no priors) on the group pool.
  - It writes the ordered list `[{ archetypeId, offeringId }] × 6` into the session snapshot (`shared_deck`), **in the same write** that sets the status to `swiping`.
  - Members read the shared cards from the snapshot and **never compute them**, so all devices show the same cards.
  - A client that can't resolve a shared card ID is blocked by the version check (§12.7).
- **Cards 7–12: personal.** Narrow, then Confirm, on the member's own profile, drawn from the group pool.
- **Joining closes at Start.** The pool and the shared deck are fixed at that moment. A late joiner could add a diet constraint that the shared cards violate. Late joining is **[DEFERRED]**.
- There is no early stop in a group; the fixed length keeps things fair and synchronised.
- `Love this` = `super_yes`.

### 12.4 Aggregation

```
vetoed(a)  ⇔ any included member NOPEd a
G(a) = mean_i s_i(a) − λ · Σ_i max(0, τ − s_i(a))        λ = 1.0, τ = −0.10   ("average without misery")
unanimous(a) ⇔ every included member said YES / Love this to a
commonGround = { f : pref_i(f) ≥ 0.20 and confidence_i(f) ≥ 0.30 for every member i }
conflicts    = { f : pref_i(f) ≥ 0.40 for some i and pref_j(f) ≤ −0.30 for some j }
groupRank(a) = G(a) + w_p · priceFit + w_d · distanceFit   (host context)
```

### 12.5 Classification

| State | Condition | Result |
|---|---|---|
| **WINNER** | Any unanimous archetype (best by G), **or** max G ≥ 0.35 with minᵢ sᵢ ≥ 0.20 | Hero directly |
| **COMMON_GROUND** | max G ≥ 0.10 and minᵢ sᵢ ≥ τ | Hero + common-ground explanation + optional final round |
| **NOBODY_AGREES** | otherwise | Compromise (below), then an automatic final round |

**Compromise:**
1. Relax distance × 1.5 and the budget cap.
2. Rank by the egalitarian score `minᵢ sᵢ(a)`, ties broken by G.
3. If vetoes leave fewer than 3 candidates, lift vetoes and say so: "Everything got vetoed, so we're ignoring the vetoes."

### 12.6 Final round

- **Candidates:** the top 3 by the relevant ranking, diverse as in §10.5.
- **Vote:** each member approves any number of them.
- **Winner:** most approvals. Ties go to higher G, then higher minᵢ sᵢ, then id.
- **Zero approvals overall:** take the egalitarian top, with "Fine. We picked for you."

### 12.7 Consistency across clients

- The session stores `seed`, `engineVersion`, `catalogueVersion` and the host-written `shared_deck`.
- A client with a different version is blocked with a "please refresh" state.
- **Card parity** is guaranteed by the snapshot, not by recalculation on each device.
- **Result parity:** results are still calculated by each client from the shared swipe log. That relies on determinism plus version pinning, and it's tested.
- Having the host publish the result as well, like the deck, is available hardening. **[DEFERRED]**

---

## 13. Mock catalogue requirements

### 13.1 Size and coverage (enforced by `validateCatalogue` tests)

| Requirement | Target |
|---|---|
| Archetypes | ~72 (built: 84) |
| Venues (fictional, around a fixed point) | ~36 (built: 36) |
| Offerings | ~150, 1–4 per archetype (built: 137) |
| Cuisines | all 16, each with ≥ 3 archetypes |
| Vegetarian archetypes | ≥ 25 % |
| Vegan | ≥ 12 % |
| Gluten-free offerings | ≥ 15 % |
| Pork-free | ≥ 75 % |
| Each spice level | ≥ 10 % of archetypes |
| Each richness level | ≥ 10 % |
| Adventurousness levels 3–4 | ≥ 15 % combined |
| Each mood tag | ≥ 8 archetypes |
| Desserts | ~6 |
| Breakfast | ~5 |
| Prices | £5–£30; ≥ 20 % under £10; ≥ 15 % over £16, the mid-budget ceiling (rev. 2: was £18, which realistic London prices rarely exceed) |
| Venue distances | 40 % ≤ 1 mi, 40 % 1–2.5 mi, 20 % 2.5–4 mi |
| Venues without delivery / without dine-in | ≥ 15 % each |

### 13.2 Minimal pairs (critical for engine rigour)

The catalogue must contain sets of archetypes that differ in **one** dimension, so personas and the engine can pull features apart. At least 12 sets, for example:

- Chicken ramen / tonkotsu ramen / miso vegetable ramen (protein and richness).
- Korean fried chicken / Nashville hot chicken / chicken karaage (cuisine at a fixed format and texture).
- Chicken katsu curry / chicken tikka masala / Thai green curry (cuisine and spice within curry).
- Margherita / nduja pizza (spice).
- Caesar salad / chicken shawarma bowl (richness and format adjacency).

### 13.3 Location

- `FixedLocationProvider` returns **Angel, Islington (N1): 51.5322, −0.1058**.
- Distance is haversine in miles.
- Walk time = 20 min/mile. Delivery estimate = 15 + 6 × miles, rounded to 5 minutes.

### 13.4 Naming

- Venue and offering names are fictional, with a best-effort check against real London restaurants.
- No real brands, chains or trademarks.

### 13.5 Images

**One generated hero image per archetype is required (72). Offering-specific images are optional.**

- **Style guide** (full version in `docs/image-style-guide.md` during M1):
  - Premium editorial food photography, not an "AI look".
  - 4:5 portrait, three-quarter angle (35–45°).
  - Soft natural window light from the left with gentle falloff.
  - Neutral, matte, warm-toned surfaces (stone, linen, dark ceramic).
  - Shallow depth of field. Realistic textures (crumb, steam, char, sauce gloss).
  - A single serving, the food filling 60–70 % of the frame.
- **Prohibited:** text, logos, packaging branding, hands, faces, cutlery clutter, garnish that couldn't be real, glossy plastic-looking surfaces.
- **QA checklist per image:** anatomically plausible food, no melted or duplicated elements, consistent white balance across the set, matches the archetype (a ramen is ramen), readable at 360 px wide.
- **Delivery:** AVIF + WebP at 640w and 1080w, plus a `dominantColour` placeholder.
- **Abstraction:** `ImageRef.kind = 'generated'`, so real or licensed images can replace them without code changes. The UI can label images as "illustrative" if needed later.
- **Dependency:** I (Claude) can write prompts and run QA, but cannot generate images. See §24 open items.

---

## 14. Engine test and persona strategy

### 14.1 Unit and property tests (Vitest + fast-check)

- **Evidence maths:**
  - YES/NOPE updates, spill-over, spill-over never touching raw counts.
  - Recency decay equals the closed form γ^(N−t).
  - Priors and raw counts are never decayed.
  - Blame: zero for certain or zero-salience features; zero for shielded features on the first NOPE; lifted on the second; per-feature cap; Σ raw = 0 case.
- **Clusters and pivot:**
  - k-medoids is deterministic, with cluster sizes in bounds.
  - Anchors come from adjacent, non-cold clusters.
  - The pivot fires only on 3 consecutive Narrow NOPEs, at most twice per session.
  - Flattening lasts exactly 3 cards.
  - The pivot never changes user settings.
- **Diet matrix:** every constraint combination. Property: no ineligible candidate ever surfaces (cards, shortlist, group).
- **Context:** haversine against known pairs, `priceFit`/`distanceFit` boundaries, meal-time windows.
- **Scoring:** bounds (taste ∈ (−1, 1)), normalisation, deterministic tie-breaks.
- **Belief and EIG:**
  - Entropy maths.
  - EIG ≥ 0.
  - EIG on a uniform belief prefers splitting cards (a crafted fixture).
- **Stopping rule:** a table-driven test for each condition and reason.
- **Session reducer:** undo equals replay (including undoing a swipe that triggered a pivot), "Not quite" flow, restore from the event log.
- **Explanations:** quantifier rules, and no claim without evidence.
- **Group:** unanimous, common ground, veto, compromise, lifted vetoes, final-round ties, excluded unfinished member, cross-client determinism, members reading the host-written shared deck rather than computing it, joining refused after Start.
- **Catalogue:** the coverage and consistency rules from §5.3 and §13.1.

### 14.2 Personas (hidden ground truth)

To avoid the engine grading its own homework, **personas use a different utility form from the engine**. They have ceilings, interactions and non-additive rules.

```ts
interface Persona {
  id: string; description: string
  tapsCraving: CravingSelection; diet: DietConstraint[]; settings: Partial<SessionSettings>
  utility: (a: DishArchetype, o: Offering) => number   // hidden truth; may include interactions
  threshold: number                                     // YES if utility + noise > threshold
  noise: { flipProb: number; gaussianSd: number }
}
truthTop3 = top 3 eligible archetypes by utility
```

| # | Persona | Tests |
|---|---|---|
| P1 | **Heat seeker:** loves spice ≥ 3, crispy, chicken; cuisine-agnostic | Axis learning, texture |
| P2 | **Comfort classicist:** British/Italian, rich, spice ceiling 1, low adventure | Ceiling detection |
| P3 | **Fresh & light:** bowls, Vietnamese/Japanese, richness ≤ 1, fish OK | Negative rich evidence |
| P4 | **Vegan explorer:** vegan, adventure ≥ 3, aromatic | Hard filter + novelty |
| P5 | **Noodle monomaniac:** any noodles, anything else is so-so | Format dominance |
| P6 | **Needle in a haystack:** flat preferences except wants dumplings tonight; taps "No idea" | Information gain |
| P7 | **Mis-stated craving:** taps "Fresh", actually wants indulgent | Swipes override priors |
| P8 | **Pescatarian Mediterranean** | Diet + cuisine family |
| P9 | **Picky:** high threshold, only burgers and pizza | Silent pivot recovery, max-reached |
| P10 | **Noisy swiper:** P1 tastes, 20 % random flips | Robustness |
| P11 | **Two modes:** Indian curries *or* Mexican tacos, equally | Echo chamber / premature lock |
| P12 | **Easy yes:** low threshold, mild preference for spice | Discrimination with little signal |
| P13 | **Interaction:** spicy *only* on noodles, mild otherwise | Non-additive truth (expected to be hard; reported, not gated) |

**Group scenarios:**

| Scenario | Members | Expected |
|---|---|---|
| G-A | P1 + P5 + a spicy-comfort persona | WINNER or COMMON_GROUND around spicy noodles |
| G-B | P4 (vegan) + P1 | Pool restricted to vegan; COMMON_GROUND on spicy vegan |
| G-C | P3 + P2 + P9 | NOBODY_AGREES → compromise → final round |
| G-D | 6 members with mixed diets | Stress: pool size, determinism, timing |

Group truth = argmax of the *true* average-without-misery over true utilities.

### 14.3 Metrics (per persona, 200 seeds each)

| Metric | Definition |
|---|---|
| Swipes to stop | mean / median / p90, split by stop reason |
| Swipes to correct | first swipe index at which `top ∈ truthTop3` and stays there |
| hit@1 | hero ∈ truthTop3 |
| hit@3 | any shortlist item ∈ truthTop3 |
| Regret | utility(best) − utility(hero), normalised |
| Feature recovery | precision@5 of the engine's top features vs the persona's true top features; Spearman ρ |
| Max-reached rate | % of sessions stopping at 15 |
| Information gain per swipe | the actual entropy drop of the belief per card |
| Exploration value | ablation: EIG policy vs greedy (exploit only) vs random, on swipes-to-correct and hit@1 |
| Decay value | ablation: γ = 0.92 vs γ = 1.0 on hit@1, swipes-to-correct, P7 |
| Pivot recovery | pivot rate; % of pivots followed by a YES within 2 cards; hit@1 in sessions with vs without a pivot |
| Innocent-feature blame | share of NOPE blame landing on features the persona actually likes (the §7.3 risk) |
| Premature lock | % of sessions where the swipe-4 top-1 never changes and is wrong |
| Diversity | distinct families in the first 8 cards; for P11, % of sessions exploring both modes |
| Explanation faithfulness | % of reasons that are among the persona's true liked features; unsupported claims (must be 0) |
| Determinism | same seed → byte-identical transcript (snapshot) |

### 14.4 M0 exit criteria (initial targets; reviewed with you after the first full run)

> **Superseded at M0 close (rev. 4).** The approved criteria and the final scorecard are in docs/m0-report.md. In short: "acceptable hero ≥ 90%" and "hit@3 ≥ 80%" replace the hit@1/hit@3 targets (hit@1 is still reported); max-reached is measured over gated personas excluding P12; feature recovery and group final-pick accuracy are deferred.

| Criterion | Target |
|---|---|
| Median swipes to stop (P1–P8, P11, P12) | 8–12; p90 ≤ 14 |
| Max-reached rate (excluding P9, P10) | ≤ 10 % |
| hit@1 / hit@3 (low-noise personas) | ≥ 70 % / ≥ 90 % |
| hit@1 / hit@3 (P10 noisy) | ≥ 50 % / ≥ 75 % |
| EIG vs greedy | ≥ 15 % fewer swipes-to-correct **or** ≥ 10 pt higher hit@1 |
| EIG vs random | clearly better on both |
| Feature recovery precision@5 | ≥ 0.6 |
| P7 (mis-stated craving) hit@3 | ≥ 70 % (priors must not dominate) |
| P11 premature lock | ≤ 20 % |
| Diet violations / unsupported claims | **0** (hard gate) |
| Group scenarios | correct classification in ≥ 90 % of seeds; results identical across simulated clients |

### 14.5 Tooling

- `npm run sim` writes `sim-report.md` (tables per persona, ablation comparison, histograms as text) and JSON transcripts.
- `npm run sim -- --sweep` runs a small grid over β, κ, η_no and the stop thresholds.
- The debug panel can load any transcript.

---

## 15. Technical architecture

```
            ┌─────────────────────────── UI (React) ───────────────────────────┐
            │ screens · components · design tokens · copy · debug overlay       │
            └──────────────┬───────────────────────────────┬───────────────────┘
                           │ dispatch(event) / select       │
            ┌──────────────▼──────────────┐      ┌──────────▼──────────┐
            │  app state (Zustand stores) │      │  sync (M2)          │
            │  wraps engine reducers      │◄────►│  GroupTransport     │──► Supabase
            └──────────────┬──────────────┘      │  (+ InMemory fake)  │
                           │                     └─────────────────────┘
            ┌──────────────▼──────────────────────────────────────────┐
            │  engine (pure TS): featurize · profile · score · belief │
            │  deck · stop · shortlist · explain · group · reducers   │
            └──────┬───────────────────────────────────┬──────────────┘
                   │ Candidate[]                       │ config, seed, now
            ┌──────▼─────────┐   ┌──────────────┐   ┌──▼───────────┐
            │ catalog repo   │   │ location     │   │ analytics    │
            │ (Mock → API)   │   │ (Fixed → GPS)│   │ (EventSink)  │
            └────────────────┘   └──────────────┘   └──────────────┘
```

**Boundary rules, enforced by ESLint import restrictions:**

- `engine/` may import only `domain/`. It must not import React, Supabase, `catalog/` implementations, `location/` implementations, `app/`, `sync/` or `window`/`Date.now`/`Math.random`.
- `domain/` imports nothing internal.
- Only `sync/supabase/` imports `@supabase/supabase-js`.
- `app/` never calculates scores; it calls the engine API.
- `sim/` imports `engine/`, `domain/` and `catalog/mock` only.

**Engine public API (sketch):**

```ts
createSoloSession(input: { catalogue, context, craving, seed, config }): SoloState
soloReducer(state: SoloState, event: SoloEvent): SoloState    // START | SWIPE | UNDO | PICK | DECIDE | NOT_QUITE | RESET
selectNext(state): CardChoice | StopResult
explain(state, archetypeId): Explanation
computeGroupResult(snapshot: GroupSnapshot, catalogue, config): GroupResult
sharedGroupDeck(pool, seed, config): CardChoice[]
```

---

## 16. File / folder structure

```
/
├─ docs/
│  ├─ MVP_SPEC.md                 (this file)
│  ├─ labelling-rubric.md         (M0)
│  └─ image-style-guide.md        (M1)
├─ src/
│  ├─ domain/                     taxonomy.ts · types.ts · schemas.ts · diet.ts · ids.ts
│  ├─ catalog/
│  │  ├─ CatalogRepository.ts     (async interface)
│  │  ├─ validateCatalogue.ts
│  │  └─ mock/                    archetypes.ts · venues.ts · offerings.ts · MockCatalog.ts
│  ├─ location/                   LocationProvider.ts · FixedLocationProvider.ts · geo.ts
│  ├─ engine/
│  │  ├─ index.ts                 (public API only)
│  │  ├─ config.ts                (EngineConfig + defaults)
│  │  ├─ rng.ts
│  │  ├─ features/                featurize.ts · salience.ts
│  │  ├─ profile/                 evidence.ts · update.ts · priors.ts
│  │  ├─ context/                 eligibility.ts · fit.ts
│  │  ├─ scoring/                 taste.ts · rank.ts · breakdown.ts
│  │  ├─ belief/                  belief.ts · entropy.ts
│  │  ├─ deck/                    selectNext.ts · phases.ts · infoGain.ts · adjacency.ts · repetition.ts · pivot.ts
│  │  ├─ clusters/                kmedoids.ts · clusters.ts
│  │  ├─ stopping/                shouldStop.ts · narrowingCounter.ts
│  │  ├─ shortlist/               shortlist.ts
│  │  ├─ explain/                 explain.ts · quantifiers.ts · vocabulary.ts
│  │  ├─ group/                   pool.ts · sharedDeck.ts · aggregate.ts · classify.ts · finalRound.ts
│  │  └─ session/                 soloReducer.ts · groupMemberReducer.ts
│  ├─ analytics/                  events.ts · EventSink.ts · LocalSink.ts
│  ├─ sync/                       (M2) GroupTransport.ts · InMemoryTransport.ts · supabase/
│  ├─ app/                        (M1; the debug panel in M0)
│  │  ├─ routes/  screens/  components/  design/  copy/  state/  debug/
│  │  └─ main.tsx
│  └─ sim/
│     ├─ personas/                p01-heat-seeker.ts …
│     ├─ groupScenarios.ts · policies.ts · runSession.ts · metrics.ts · report.ts · cli.ts
├─ public/images/archetypes/      (M1)
├─ supabase/migrations/           (M2)
└─ tests colocated as *.test.ts
```

It's a single package with import boundaries enforced by lint. A monorepo split (`packages/engine`) is **[DEFERRED]** until a server needs the engine.

---

## 17. Tech stack

| Layer | Choice | Scope |
|---|---|---|
| Language | TypeScript 6.0 (strict, `noUncheckedIndexedAccess`); TS 7 once typescript-eslint supports it | NOW |
| UI | React + Vite | NOW (M0 debug panel, M1 app) |
| Routing | React Router | NOW |
| State | Zustand around pure engine reducers | NOW |
| Motion / gestures | Motion (formerly Framer Motion) | NOW (M1) |
| Styling | Tailwind CSS with a strict design-token layer | NOW (M1) |
| Validation | Zod | NOW |
| Tests | Vitest, fast-check | NOW |
| Sim runner | `tsx` CLI | NOW |
| E2E | Playwright (including multi-context group tests) | NOW (M2–M3) |
| Lint / format | ESLint (import boundaries) + Prettier | NOW |
| Backend | Supabase: Postgres, Realtime, anonymous auth | NOW (M2 only) |
| Hosting | Vercel (or Netlify) | NOW (M1+) |
| Package manager | npm (pnpm not installed; no benefit worth a global install) | NOW |
| Remote analytics | e.g. PostHog | DEFERRED |
| Next.js / SSR | — | NOT NEEDED |

Exact versions are pinned in `package.json` (M0.1). The engine is also type-checked with no DOM or Node types (`tsconfig.core.json`), so browser or Node access fails to compile.

---

## 18. State management approach

- **Engine state is event-sourced.** `SoloState` is the result of `(initial input, events[])`.
  - Undo = replay without the last event.
  - Refresh recovery = replay from `sessionStorage`.
  - Group results = the same replay over the shared log.
  - Debugging = replaying transcripts.
- **Zustand stores:**
  - `useSoloSession`: holds `{ input, events, state }`, exposes `dispatch`, derives selectors (current card, counter, match).
  - `useSettings`: diet, budget, fulfilment. Persisted to `localStorage`, versioned, reads wrapped in try/catch.
  - `useSaved`: saved matches, persisted.
  - `useGroupSession` (M2): mirrors the transport snapshot and runs engine functions over it.
- **Component-local state:** only for ephemeral UI (drag position, sheet open).
- **Not persisted:** the taste profile (session-scoped by principle). It's cleared at "Start over" and at the end of the session.

---

## 19. Supabase boundary (M2)

### 19.1 Rule

Supabase exists **only** behind `GroupTransport`. The engine and the solo flow never touch it. The solo MVP runs with no network at all.

```ts
interface GroupTransport {
  createSession(input): Promise<{ sessionId; code }>
  joinSession(code, member): Promise<MemberHandle>
  updateMember(patch): Promise<void>
  submitSwipe(swipe): Promise<void>          // idempotent on (memberId, cardIndex)
  submitVote(vote): Promise<void>
  startSession(sharedDeck): Promise<void>    // host only; writes shared_deck + status 'swiping' in one write
  setStatus(status): Promise<void>           // host only
  subscribe(sessionId, onSnapshot): Unsubscribe
}
```

`InMemoryTransport` implements this for tests, sims and local development.

### 19.2 Schema

| Table | Columns |
|---|---|
| `group_sessions` | id, code (unique, 6 chars, no 0/O/1/I), host_member_id, settings jsonb, seed, engine_version, catalogue_version, **shared_deck jsonb** (null until Start; ordered `[{archetype_id, offering_id}]`), status (`lobby` / `swiping` / `results` / `final_round` / `done`), created_at, expires_at (24 h) |
| `group_members` | id, session_id, auth_uid, display_name, diet jsonb, craving jsonb, status (`joined` / `ready` / `swiping` / `finished`), joined_at |
| `group_swipes` | session_id, member_id, card_index, archetype_id, offering_id, verdict, created_at; **unique (member_id, card_index)** — upsert supports undo |
| `group_votes` | session_id, member_id, archetype_id, approve; unique (member_id, archetype_id) |

### 19.3 Auth and RLS

- Anonymous sign-in.
- A member can read all rows of sessions they belong to.
- A member can insert or update only their own member, swipe and vote rows.
- Only the host can update the session's status and `shared_deck`.
- `shared_deck` is write-once: a trigger rejects any change after it's set.
- Member inserts are rejected once the status is no longer `lobby`.

### 19.4 Realtime

- `postgres_changes` subscriptions filtered by `session_id`.
- Clients rebuild the snapshot and recompute locally.

### 19.5 Honest privacy note

- "Private swiping" is private **in the interface**: nobody sees who swiped what. But the swipe rows are readable by other members' clients, because each client computes the result.
- This is acceptable for a prototype among friends. Server-side calculation, with swipes readable only by their owner, is **[DEFERRED]**.

### 19.6 Not in Supabase for the MVP

- The catalogue (bundled with the app), analytics, and solo sessions.

---

## 20. Future real-data integration strategy

1. **`CatalogRepository` is async from day one.**
   - `getEligibleCandidates(context): Promise<Candidate[]>`, `getArchetypes()`, `getOffering(id)`.
   - `MockCatalog` becomes `ApiCatalog` with no call-site changes.
2. **The taxonomy is the contract.** Real menu items go through an enrichment pipeline:

   ```
   raw item (name, description, price, photo)
     → normalise
     → classify archetype + features (LLM constrained to the taxonomy, with a confidence score)
     → human review queue below the threshold
     → Offering
   ```

   Offerings inherit most features from their archetype, which keeps enrichment tractable.
3. **Candidate generation moves to the server; ranking stays portable.**
   - Postgres/PostGIS filters by location, hours and diet and returns about 300 candidates.
   - The same engine ranks them on the device or on the server.
4. **Images:** `ImageRef.kind` separates generated, licensed and venue images. The UI can label illustrative images. There's a typographic card fallback for missing images.
5. **Location:** `GeolocationProvider` (permission flow, falling back to postcode entry) replaces `FixedLocationProvider`.
6. **Long-term taste:**
   - A `ProfileStore` interface. A long-term profile feeds the session as a **capped prior** (≤ 1.0 pseudo-count per feature), so tonight's evidence still dominates.
   - "Not right now" NOPEs never flow into it without repetition across sessions.
7. **Model upgrades:**
   - Any scorer, e.g. a learned model, embeddings or a contextual bandit, must implement `taste(a)` and emit a `ScoreBreakdown`, so explanations and group logic survive.
   - The swipe event log is the training dataset.
8. **Hand-off:** `HandoffTarget` covers delivery-platform links and maps. Expect deep links at restaurant level at best; ordering individual dishes via partners needs checking with each platform.
9. **Versioning:** `taxonomyVersion`, `catalogueVersion` and `engineVersion` are stamped on sessions and analytics events.

---

## 21. Analytics / events

- **Sink:** a `LocalSink` in the MVP (console in development, in-memory, plus a `localStorage` ring buffer of the last 500 events) behind an `EventSink` interface.
- **Common properties** on every event: `sessionId`, `engineVersion`, `catalogueVersion`, `ts`.
- **No personal data.** Group display names are never logged.

| Event | Key properties |
|---|---|
| `app_opened` | referrer (group link?) |
| `mode_selected` | solo / group |
| `craving_submitted` | moods, intent, diet, budget, fulfilment, eligibleCount |
| `card_shown` | cardIndex, archetypeId, offeringId, phase, slotType (normal / adjacency / shared / personal), eig, finalRank, counterRaw, counterShown |
| `swipe` | cardIndex, verdict, method (gesture / button / keyboard), dwellMs |
| `undo` | cardIndex |
| `pivot_triggered` | cardIndex, pivotNumber, fromClusterId, anchorArchetypeId (logged only, never shown to the user) |
| `decide_for_me` | cardIndex |
| `match_shown` | stopReason, swipes, timeToMatchMs, m3, confidenceLabel, heroArchetypeId, heroWasSeen |
| `match_action` | order / directions / save / not_quite / runner_up_promoted / start_over |
| `handoff_opened` | kind, platform label |
| `session_abandoned` | lastCardIndex, msSinceLastAction (on hide / unload before a match) |
| `group_created` / `group_joined` / `group_started` | memberCount |
| `group_member_finished` | swipes, ms |
| `group_result` | state, includedMembers, vetoCount, commonGroundSize, forced |
| `final_round_vote` / `final_round_result` | approvals, tieBreak |

**Derived KPIs:**

| KPI | Definition |
|---|---|
| Time to decision | median `timeToMatchMs` |
| Swipes to match | median and p90 |
| Match action rate | Order or Directions ÷ matches |
| Not-quite rate | |
| Decide-for-me rate | |
| Pivot rate | Plus YES rate on the anchor card |
| Abandonment curve | by card index |
| Group | completion rate, state distribution |

---

## 22. Accessibility requirements

- **Every gesture has an alternative:**
  - YES / NOPE buttons.
  - Keyboard: ← NOPE, → YES, Enter = That's the one, Backspace / ⌘Z = Undo.
- **Screen readers:**
  - Each card is announced as "{offering}, {archetype}, {venue}, £{price}, {distance}. {spice level}."
  - Buttons have explicit labels.
  - The narrowing counter is `aria-live="polite"`.
  - On the Match screen, focus goes to the heading.
- **YES/NOPE never rely on colour alone:** always an icon and a text label.
- **Reduced motion** (`prefers-reduced-motion`): swipe flings become short fades, with no parallax or confetti.
- **Contrast:** WCAG 2.2 AA. Text over images always has a scrim.
- **Touch targets** ≥ 44 × 44 px.
- **Images:** alt text is required by the schema, and decorative images are hidden from screen readers.
- **Layout:** works at 200 % zoom and with large system text, with no horizontal scrolling.
- **No forced timeouts** (a final-round timer is **[DEFERRED]** and would be optional).
- **Group codes** use unambiguous characters and are announced character by character.

---

## 23. Edge cases

| Case | Handling |
|---|---|
| Filters leave < 8 eligible archetypes | S2 warning: "Only a few options match — widen distance/budget?" Starting is allowed with a reduced budget (stop via `pool_exhausted`) |
| Filters leave 0 | Empty state with one-tap relax suggestions (diet is never relaxed automatically) |
| All NOPE | Up to 2 silent pivots (§10.3); at 15, "Best guess". No interruption |
| All YES (P12-like) | The engine relies on relative evidence and the craving. Match by the rule, or at 15 with "Best guess" |
| "Decide for me" at card 0 | Shortlist from craving priors; label "Best guess"; craving-only explanation |
| "That's the one" on card 1 | Match immediately; "Your call." |
| Undo at card 0 | Disabled |
| Undo from the Match screen | "Back" undoes the last swipe and resumes the deck |
| Second "Not quite" | Top-5 pick-list; the session ends |
| Double swipe / fast taps | One event per `cardIndex`; input locked during the fling |
| Refresh mid-session | Replay from `sessionStorage` |
| Storage unavailable (private mode) | Everything works; nothing persists |
| Missing or broken image | Typographic card using `dominantColour` |
| Hero's best offering is over budget | Can't happen: budget cap is a hard filter; `priceFit` penalises within the cap |
| Only one venue offers the hero | "Also at" hidden |
| Tied scores | Stable ID tie-break |
| Breakfast outside the window | Not eligible |
| Dessert without "sweet" | Not eligible |
| **Group:** fewer than 2 ready | Start disabled |
| **Group:** member tries to join after Start | Refused: "This session has already started" + "Start your own" (late join **[DEFERRED]**) |
| **Group:** member never finishes | Host "Show results now"; members with < 6 swipes are excluded and named |
| **Group:** host leaves | Any member can "Show results" after 2 minutes idle (host hand-over **[DEFERRED]**) |
| **Group:** network drop | Swipes are queued and retried; upsert is idempotent |
| **Group:** duplicate names | Automatic suffix ("Sam 2") |
| **Group:** invalid or expired code | Clear error + "Start your own" |
| **Group:** version mismatch | Blocked with "Refresh to join" |
| **Group:** diet union empties the pool | Lobby warning before start ("Between you, there's not much left — widen distance?") |
| **Group:** all vetoed | Lift vetoes, say so, compromise |
| **Group:** final-round tie or zero approvals | §12.6 |

---

## 24. Implementation plan: M0 → M3

### M0: Engine (no visual polish)

| Step | Deliverable | Done when |
|---|---|---|
| M0.1 | Scaffold: Vite + TS strict, ESLint boundaries, Vitest, npm scripts (`typecheck`, `test`, `sim`) | CI-style script passes on an empty project |
| M0.2 | `domain/`: taxonomy, types, Zod schemas, diet logic | Diet matrix tests pass |
| M0.3 | Labelling rubric + mock catalogue (72 / 36 / 150) + `validateCatalogue` | Coverage and minimal-pair tests pass |
| M0.4 | `location/` + context eligibility and fit | Geo and fit tests pass |
| M0.5 | Features, evidence, priors, updates (incl. blame and spill-over) | Profile tests pass |
| M0.6 | Taste, belief, final rank, breakdown, shortlist | Scoring tests pass |
| M0.7 | Deck: EIG, phases, adjacency, repetition, clusters and anchors, branch pre-computation | Deck and cluster tests pass; `selectNext` benchmark ≤ 50 ms (Node, scaled) |
| M0.8 | Stopping rule, narrowing counter, silent pivot, solo reducer (undo, pick, decide, not-quite) | Reducer, pivot and replay tests pass |
| M0.9 | Explanations + quantifiers + vocabulary | Faithfulness tests pass (0 unsupported claims) |
| M0.10 | Group: pool, shared deck (host-written into the snapshot), aggregation, classification, final round, `InMemoryTransport` | Group scenario tests pass; card parity from the snapshot; cross-client result determinism |
| M0.11 | Personas P1–P13, group scenarios, policies (EIG / greedy / random), metrics, report, sweep | `sim-report.md` generated |
| M0.12 | Debug panel D1 (plain UI, transcript replay) | Can reproduce any sim session by seed |
| M0.13 | Tuning pass + **review with you** | Exit criteria in §14.4 met or consciously revised together |

### M1: Solo experience, fully polished

1. **Design direction:** 2 short directions (type, colour, texture, motion references, the card and match screen in each) → you choose.
2. **Image style guide** → a 6-image pilot → approval → full 72-image set with QA.
3. Design tokens and core components (card, chips, buttons, sheets, counter).
4. Screens S1–S8, with gestures and motion, branch prefetch, and the reveal transition.
5. Persistence (settings, saved, session restore). `LocalSink` analytics. Copy deck.
6. Accessibility pass (§22). Real-device testing (iOS Safari, Android Chrome).
7. Deploy a preview.

**Exit:** the full solo loop works on a phone. In informal tests with 5 people, median time to decision is ≤ 60 s. No accessibility blockers.

### M2: Group mode

1. Supabase project, migrations, RLS, anonymous auth.
2. `SupabaseTransport` implementing `GroupTransport`. Contract tests shared with `InMemoryTransport`.
3. Screens G1–G7, the share link, reconnect and retry, version pinning.
4. Playwright tests with 3 browser contexts.

**Exit:** 3 real phones complete a session end-to-end, results are identical on every client, and all four classification paths have been exercised.

### M3: Tuning and hardening

1. Re-tune the engine using logged events from real sessions (M1/M2 testers).
2. Edge-state polish, performance (image weight, JS bundle budget), Playwright end-to-end for the main journeys.
3. Accessibility audit, error monitoring (lightweight), production deploy.
4. A feedback round with about 10 real users, and a KPI readout against §21.

### Open items needing a decision before or during M0/M1

1. **Image generation tool.** I can't generate images. We need either your chosen tool (e.g. Midjourney, run by you from my prompts) or an image API with a key and budget. Needed by M1, not M0.
2. **Working name.** Needed by M1 for the wordmark. Avoid anything involving "Tinder".
3. **Exit targets (§14.4).** Please confirm or adjust before M0 begins.
4. **Supabase account.** Needed at M2.

---

## Revision log

| Rev | Date | Change |
|---|---|---|
| 1 | 2026-09-24 | First complete draft |
| 4 | 2026-09-24 | **M0 closed.** Approved: the §14.4 exit-criteria revisions (docs/m0-report.md §4A) and revision 3. Deferred: group engine tuning (to M2) and contrast-based explanation reasons |
| 3 | 2026-09-24 | **Engineering fixes and M0.13 tuning (for your review; evidence in docs/m0-report.md):** (1) p_yes in EIG is belief-predictive, Σ P(a)·sim(a,c)², replacing σ(κ·taste) (§9.1); (2) a cluster whose anchor was NOPEd counts as cold (§9.7); (3) PAM clustering, k = 13 (§9.7); (4) price coverage > £16 (§13.1); (5) β 6 → 20 (§8.4); (6) support taste 0.30 → 0.15, min swipes 6 → 8, Confirm not before card 6, stability tolerates same-cluster swaps (§9.2, §10.1). Tried and rejected: counting post-probe NOPEs for the pivot (the noodle persona hit the cap 65% of the time vs 6%); a support gate on the pivot (no effect). **Proposed, not applied:** revised exit criteria (docs/m0-report.md §4) |
| 2 | 2026-09-24 | **Approved with these changes:** (1) recency decay γ = 0.92 on swipe evidence (§7.2–7.3); (2) NOPE blame strictly uncertainty × salience, no flat offset, confidently liked features (pref > 0.5) shielded until a repeat NOPE (§7.3); (3) "Tough crowd" interstitial replaced by a silent engine pivot, with clusters and high-fidelity anchors defined in §9.7 and §10.3; (4) the host writes the group shared deck into the session snapshot (§12.3, §12.7, §19). Knock-on changes: joining closes at Start; the pivot never relaxes user settings; new ablations and metrics (§14.3); the blame-allocation risk is recorded in §7.3 |
