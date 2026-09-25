# Dish imagery: art direction brief and test batch (M1.6)

**Status:** test batch in review. Decision (2026-09-25): option A, AI-generated, one image per dish
*archetype*, subject to the conditions below. **Revised 2026-09-25: images are cutouts** (just the
plate on a transparent background), not full-frame photographs. **If the test batch doesn't pass
review, the MVP stays photo-free** (the designed no-photo state already ships).

## 1. Why these rules exist

The images sit on the swipe cards, so they shape the verdicts the engine learns from. If one dish
gets a gorgeous photo and another a flat one, people swipe on the photograph, not the food, and
the taste profile learns noise. **Consistency and appetite parity matter more than any single
beautiful shot.** Every image is also a stand-in for the dish in general, never a venue's actual
plate: the app labels it "Illustrative image" and says so in the alt text.

## 2. Conditions (agreed)

1. One image per archetype (e.g. "Chicken larb"). Never per venue or offering, which would imply
   it's that restaurant's dish.
2. Every image is reviewed for accuracy against the catalogue's key ingredients before use.
3. The "Illustrative image" label stays on every generated image.
4. Provenance is recorded per image: generator and model version, prompt, seed (if shown), date,
   plan/licence tier. This goes into the catalogue's `credit` field via the manifest.
5. A 6-image test batch comes first. No image enters the repo until the batch passes review.

Licensing check before generating: confirm your plan allows commercial use of outputs. For
context, UK law gives computer-generated works a copyright owned by whoever made the
arrangements for their creation (CDPA 1988 s9(3)); the US generally doesn't recognise copyright
in purely AI-generated images, so we shouldn't rely on exclusivity.

## 3. Art direction (Direction A, "Order Pad"): cutouts

The app is warm paper (#F3ECDF), dark ink and a paprika accent. Each dish is shown as a **cutout**:
just the plate, on a transparent background. The app places it whole and centred in its frame,
on the dish's own tint, and adds one soft shadow itself. Nothing is cropped, so the frame's shape
(16:10 or 4:3 on the card, 16:10 on the Match screen, square in lists) never cuts off food.

Why cutouts: every plate sits on the same designed ground, so the set looks consistent even when
generations differ in background or lighting, and appetite parity is easier to hold.

| | Rule |
|---|---|
| **Angle** | Straight overhead (90°) for every dish, so every plate reads as a clean round or oval shape. |
| **Subject** | One serving on one plate, bowl or platter. **Everything on the plate:** garnishes, sides and extras sit on it, never loose beside it. |
| **Framing** | The whole plate in view, rim included, with a margin of about 8–10% of the frame on every side. Nothing touches the edge. |
| **Background** | Transparent in the final file. Most generators can't output transparency, so **generate on a flat, plain, evenly lit background that contrasts with the plate** (mid-grey or muted blue-grey behind off-white crockery), then remove it. A white plate on a white background cuts out badly. |
| **Shadow** | None baked in: no cast shadow on the background. The app draws one consistent shadow. |
| **Crockery** | Plain matte off-white or sand ceramics. No patterns, coloured rims, logos or branded packaging. Street food goes on a plate too (it may be lined with plain brown paper that stays within the plate). |
| **Light** | Soft, even light from slightly upper left, a little warmth. No dramatic or moody lighting, no hard highlights. |
| **Colour** | True to life, lightly warm, not oversaturated. Browns (curries, stews) must still read as appetising, not muddy. |
| **Realism** | Real restaurant food with small natural imperfections (a crumb, a drip). Not glossy, plastic or CGI-perfect. |
| **Never** | People, hands, cutlery, text or lettering of any kind, logos, menus, newspaper print, drinks, extra dishes, steam effects, frames or borders. |
| **Output** | Transparent PNG or WebP (with alpha), **3:2 or square**, at least 2048 px on the long edge, named `<archetype-id>.png`. |

## 4. Prompts

Each prompt is the **style block** followed by the **dish block**. Use the same generator, model
version and settings for all six. If your generator supports a style or reference image, use your
first accepted image as the reference for the rest. Then remove the background (any automatic
tool is fine) and check the edges (section 5).

### Style block (paste verbatim before every dish)

> Overhead food photograph shot straight down at 90 degrees. A single serving on one plain matte
> off-white ceramic plate or bowl, centred, with the whole plate and its rim in view and even empty
> space around it on every side. Everything is on the plate; nothing beside it. Plain flat
> mid-grey seamless background, evenly lit, with no cast shadow. Soft even light from slightly upper
> left with gentle warmth. True-to-life, lightly warm colours, not oversaturated. Real restaurant
> food with small natural imperfections. Calm, minimal, editorial. Square format.

### Avoid (negative prompt, or append as "No …" if your generator has no negative field)

> people, hands, cutlery, text, lettering, words, logos, branding, menus, newspaper, packaging,
> patterned plates, coloured rims, tablecloth, linen, wood, slate, marble, props beside the plate,
> garnish beside the plate, cast shadow, dramatic lighting, steam, drinks, extra dishes, cropped
> plate, plate touching the edge, plastic CGI look, oversaturated colours, borders, frames

### The six dishes

Six cuisines, three kinds of difficulty: a bowl with liquid, a flat bake, a loose herb salad,
street food, a brown curry (the hardest to make appetising) and a multi-part platter.
**Chicken larb** and **beef suya** are the less familiar dishes, where generators most often go wrong.

**1. `tonkotsu-ramen`: Tonkotsu ramen (Japanese)**
> A bowl of Japanese tonkotsu ramen: opaque, creamy-white pork bone broth; thin straight ramen
> noodles; two slices of rolled chashu pork belly with browned edges; a soft-boiled marinated egg
> halved to show a jammy orange yolk; thinly sliced spring onion; a small sheet of nori tucked at
> the rim; a few strips of wood ear mushroom. In a plain off-white ceramic ramen bowl.

Check: broth milky and opaque (not clear); noodles thin and straight; egg jammy, not hard-boiled;
pork is rolled belly slices, not bacon.

**2. `margherita-pizza`: Margherita pizza (Italian)**
> A whole, uncut Neapolitan-style margherita pizza about 30 cm across on a plain off-white plate a
> little larger than the pizza: puffy crust with leopard-spot charring, thin centre, bright San
> Marzano tomato sauce, a few separate torn rounds of melted fior di latte mozzarella with sauce
> showing between them, whole fresh basil leaves, a thin drizzle of olive oil.

Check: mozzarella in separate pools, not a sheet of grated cheese; no pepperoni or oregano
carpet; charred spots on a puffy rim; basil fresh and whole; the plate's rim visible all round.

**3. `chicken-larb`: Chicken larb (Thai, less familiar)**
> A plate of Thai chicken larb (larb gai): loose, crumbly minced chicken tossed with lime juice,
> fish sauce and dried chilli flakes, visibly flecked with golden toasted ground-rice powder,
> with thinly sliced shallots, plenty of torn mint leaves, chopped coriander and spring onion.
> Lightly glossy, not in a sauce. On one plain off-white plate, with a small wedge of white
> cabbage, a few long beans, cucumber slices and a lime wedge arranged on the same plate.

Check: a loose mince salad, not a saucy stir-fry and not served in lettuce cups; toasted rice
powder specks visible; herbs abundant (mint especially); chilli flakes, not fresh chilli slices
all over; the raw vegetables are on the plate, not beside it.

**4. `beef-suya`: Beef suya (Nigerian, less familiar)**
> Nigerian beef suya: thin slices of beef threaded on short wooden skewers, grilled over charcoal
> with charred edges, thickly coated in dry reddish-brown yaji spice made from ground roasted
> peanuts, chilli and ginger. Served on one plain off-white plate lined with a piece of plain
> brown paper (no print) that stays within the plate, with a heap of thinly sliced raw red onion,
> a few slices of fresh tomato and a small pile of extra yaji spice on the same plate. The skewers
> fit within the plate.

Check: meat thin, dry-rubbed with a visible powdery spice crust (not cubes, not a glossy
marinade, not a doner kebab); raw onion and tomato present; plain paper, **no newspaper text**
(generators love adding it); no skewer ends sticking out past the plate.

**5. `chana-masala`: Chana masala (Indian)**
> A bowl of Punjabi chana masala: whole, tender chickpeas in a thick, deep reddish-brown
> onion-and-tomato gravy with a slight sheen of oil at the edges, finished with fresh chopped
> coriander, a few fine slivers of ginger and one slit green chilli on top. The plain off-white
> bowl stands on a small matching plate that also holds a lemon wedge and a few rings of raw red
> onion.

Check: chickpeas whole and clearly visible; gravy thick, not soupy; colour reads rich and warm,
not muddy grey-brown. This is the appetite-parity test: it should look as good as the pizza.

**6. `mezze-platter`: Mezze platter (Lebanese)**
> A Lebanese mezze platter for one on a large plain off-white oval plate: a swirl of smooth hummus
> with olive oil pooled in the centre and a pinch of paprika; a mound of tabbouleh that is mostly
> finely chopped flat-leaf parsley with diced tomato and only a little bulgur; a scoop of smoky
> baba ghanoush with a drizzle of oil; three slices of golden grilled halloumi with char lines;
> warm pitta bread torn into triangles; a few olives. Everything on the one plate.

Check: tabbouleh green and parsley-heavy (generators often make it a grain salad); every
component distinct and identifiable; a portion for one, not a banquet; the oval plate whole.

## 5. Review (when you send the batch back)

For each image I'll check, and you'll see the scores:

1. **Accuracy:** matches the key ingredients and the dish checks above. A wrong dish fails outright.
2. **Consistency:** same angle, crockery, light direction, colour warmth and plate size in frame.
3. **Appetite parity:** no dish looks dramatically better or worse than the rest.
4. **Framing:** the whole plate with margin, nothing beside it, nothing touching the edge.
5. **Cutout quality:** clean edge all round the rim; no halo or fringe of the old background; no
   leftover shadow; no bites taken out of the rim or pale food (broth, mozzarella, hummus) where
   the removal mistook it for background; transparent everywhere else.
6. **Artefacts:** no melted cutlery, impossible textures, stray text or duplicated items.

I'll also preview the batch inside the app from the git-ignored review folder
(`src/app/debug/review-images/`, shown with `?images=review`), so we judge it on the real cards at
phone size. Nothing is committed during review.

**Pass rule:** all six pass consistency and cutout quality, and at least five of six pass accuracy
with at most two regenerations each. Any failure on a less familiar dish is a real warning, since
84 archetypes include many more like it. If the batch doesn't pass, the MVP stays photo-free.

## 6. After a pass (not part of this batch)

- Generate the remaining 78 archetypes with the same settings and reference, and cut them out.
- Convert to AVIF and WebP **with alpha** at card, hero and thumbnail sizes; build a manifest with
  provenance.
- Switch the app from `NO_IMAGES` to `manifestSource(files, { cutout: true })`. No other code changes.
