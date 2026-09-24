# Labelling rubric

The rules for labelling dish archetypes (MVP_SPEC §6.1). The catalogue test enforces what it can. The rest depends on the labeller applying this rubric consistently. Two labellers should agree within ±1 on every axis.

## Axes (0–4)

### Spice: heat as served, for a typical London diner

| Level | Meaning | Anchors |
|---|---|---|
| 0 | No perceptible heat | margherita, carbonara, fish & chips, tonkotsu ramen |
| 1 | Gentle warmth; a child could eat it | katsu curry, butter chicken, shawarma, pho |
| 2 | Noticeable heat, comfortable for most | jalfrezi, bibimbap with gochujang, banh mi with chilli, chicken burrito |
| 3 | Properly hot; some people will struggle | dan dan noodles, jerk chicken, Thai green curry, yangnyeom chicken |
| 4 | Very hot; a heat-seeker's dish | vindaloo, buldak, som tam (Thai-hot), Nashville hot, pepper soup |

### Richness: how heavy and indulgent it eats

| Level | Meaning | Anchors |
|---|---|---|
| 0 | Very light; raw, clear or clean | sashimi, summer rolls, som tam, clear tom yum |
| 1 | Light | pho, poke, Greek salad, har gow |
| 2 | Balanced | pad thai, bibimbap, falafel wrap, margherita |
| 3 | Rich | tikka masala, Korean fried chicken, risotto |
| 4 | Very rich; a food coma is likely | tonkotsu, carbonara, mac & cheese, steak & ale pie, desserts |

### Adventurousness: how unfamiliar it is to a typical London diner

| Level | Meaning | Anchors |
|---|---|---|
| 0 | Universal | fish & chips, cheeseburger, margherita, tikka masala |
| 1 | Familiar | pad thai, ramen, sushi, pho |
| 2 | A step out | bibimbap, jerk chicken, birria, char siu bao |
| 3 | Less common | buldak, mapo tofu, masala dosa, jollof, suya, som tam |
| 4 | Unusual for most | egusi, pepper soup, ackee & saltfish, ital stew, red-red |

## Mood tags (curated)

| Tag | Rule | Machine-checked |
|---|---|---|
| `comforting` | Warm, familiar, soothing. Usually hot, and richness ≥ 2 or brothy | — |
| `fresh` | Bright and light: richness ≤ 1, or raw / herby / tangy | error if richness ≥ 3 |
| `carby` | Carbs are the point: noodles, pasta, bread, rice-led, chips | — |
| `indulgent` | A treat: richness ≥ 2 and a deliberately "naughty" feel | error if richness ≤ 1 |
| `warm_soupy` | Brothy or liquid stew, served hot | error if served cold |
| `sweet` | A dessert, or a sweet-led dish | — |

`spicy` is **never** tagged. It comes from the spice axis, so the same thing isn't counted twice.

## Other fields

- **Format:** the dish's *shape*, not its cuisine. Noodle soups (ramen, pho) are `noodles` with the `brothy` texture. Fried, grilled or roast centrepieces (fried chicken, kebab plate, fish & chips) are `protein_plate`.
- **Proteins:** list the main proteins only. Leave the list empty for dishes built on vegetables or carbs.
- **Flavours / textures:** 1–3 each, the ones a diner would *name* when describing the dish.
- **Temperature:** as served. Room-temperature salads count as `cold`.
- **Dietary facts:** describe the dish as typically made. Must be consistent with the proteins (enforced in code).
- **Allergens:** only list what's *explicitly* known. Never infer them, and never show them as a safety guarantee.

## Offering overrides

Overrides are rare. They may shift an axis by at most ±1 (e.g. an extra-hot house version) and may make dietary facts *stricter* when true. They may never contradict the archetype's proteins.
