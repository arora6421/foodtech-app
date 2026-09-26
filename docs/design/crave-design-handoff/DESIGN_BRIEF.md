# Crave: visual redesign brief

This folder contains the new visual direction for the app. The seven files in `mockups/` show every main screen. Open them in a browser at a phone width (about 390 px) to see them. They are **visual references only**: rebuild the look inside the existing app and design-token system rather than pasting their HTML in.

## Ground rules (unchanged)

- Work on a new git branch called `cover-story` and push it so Vercel gives a preview link. Do not merge to `main` until I approve.
- Do not modify the M0 engine. The M0 baseline must stay identical.
- Keep the approved runner-up copy exactly: "Alternative", "Why it could suit you", "Choose this instead", "Return to our match".
- Keep all existing behaviour, tests, accessibility work (contrast, 200% zoom, 44 px targets, reduced motion) and the fixed card size.
- This is a visual change only. No new features.

## Name

"Crave" is the working app name. Put it in a single constant so it can be changed later.

## Fonts

- **Playfair Display** (700 and 900, with italics) for the masthead, headlines, numbers, prices and main buttons.
- **Instrument Sans** (400–700) for everything else.
- Replace the current fonts, and run the new ones through the existing subsetting script.

## Colours

| Role | Colour |
|---|---|
| Page background (cream) | `#F5EDE1` |
| Ink (text, rules, outlines) | `#22150E` |
| Sticker red | `#B8341C`, with cream text `#FFF6E8` |
| Cover colour | A bold version of each dish's existing tint colour |

The mockups use saffron `#F2B441` for ramen, sage `#B9CC8E` for larb, orange `#E98A4F` for chana masala and pink `#EDA48E` for pizza. Every dish needs a bold cover version of its tint, and ink text must pass the existing contrast test on all of them.

## Texture (the "printed magazine" feel)

- **Paper grain** on cover-colour surfaces only (cards, full-screen covers, saved tiles). Cream backgrounds stay clean. The mockups use an SVG `feTurbulence` noise layer with `mix-blend-mode: multiply` at about 22% opacity.
- **Halftone dots** behind every plate: a circle of small ink dots (radial gradient, 9 px spacing, about 20% opacity).
- **Offset print edge** on big headlines: `text-shadow: 2px 1.5px 0 rgba(184, 52, 28, 0.55)`.

## The swipe card (`03-swipe-card.html`, the most important screen)

- Top bar: close, the Crave masthead in the centre, undo.
- Top line of the card: cuisine and format (e.g. "Japanese noodle soup") on the left, the card number on the right, then a 2 px ink rule.
- Huge Playfair 900 dish name, two lines maximum.
- **"Inside" list** under the name: up to three key ingredients from the dish's catalogue data, one per line.
- The plate cutout bleeds off the right edge of the card, at the **same position and size on every card**.
- Round red price sticker, tilted, slightly overlapping the plate.
- Tags as ink-outlined pills, a 2 px rule, then venue and walking distance.
- **Firm rule:** the plate may bleed off the card, but it must never cover any text. Check this against the longest dish names and ingredient lists in the catalogue, not just the mockup dish.

## Other screens

- **01 Welcome:** a magazine cover, with the big Crave masthead, the cover line "Hungry? Can't decide?" and plates spread across it. "With friends" shows a "Soon" sticker, because group mode is not built yet.
- **02 Craving picker:** styled as a contents page, with the nine cravings numbered 01–09. The chosen one gets a saffron row and a red "Tonight" sticker.
- **04 Card without a photo:** the same layout as the swipe card, with a big italic initial inside a plate outline in the plate's position and size. Use this whenever an image is missing or fails to load.
- **05 Match:** a full-screen cover in the dish's colour, with the Crave masthead, a "Tonight's cover" kicker, the plate with a tilted "Strong match" sticker, and reasons numbered 01–03. Order, Get directions and Save, then "Or try" tiles.
- **06 Alternative:** the same cover style in the alternative dish's colour, using the approved copy.
- **07 Saved:** titled "Back issues". Each saved dish is a mini cover tile in its own colour, with the no-photo version used where there is no image.

## Content rules

- Everything shown about a dish comes from real data: the "Inside" list from key ingredients, the top line from cuisine and format, and the Match and Alternative reasons from engine output only. Never invent claims.
- The mockups contain sample content ("[Venue name]", prices, distances, dates and reasons). Don't copy it into the app.

## Buttons

Keep Nope, Yes and Decide for me as they are in the mockups (outlined Nope, filled ink Yes, underlined "Decide for me"). Their final look is still under review, so don't spend time elaborating them. Restyle the YES/NOPE drag stamps to fit the new look.

## Not mocked up

The order and directions sheets, the saved-dish detail page, error and empty states. Extend the same style to these after the main screens are approved.

## Order of work

1. Swipe card, card without a photo, and Match. Send me the Vercel preview link.
2. After I approve those, the remaining screens.
