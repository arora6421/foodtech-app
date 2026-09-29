import type { Offering, OfferingOverrides } from '../../domain'

// Fictional offerings: each venue's version of a dish archetype (MVP_SPEC §5.1).

function slugify(s: string): string {
  return s
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function offer(
  venueId: string,
  archetypeId: string,
  name: string,
  pricePence: number,
  description: string,
  overrides?: OfferingOverrides,
): Offering {
  return {
    id: `${venueId}-${slugify(name)}`,
    venueId,
    archetypeId,
    name,
    description,
    pricePence,
    ...(overrides ? { overrides } : {}),
  }
}

export const OFFERINGS: Offering[] = [
  // Kōen Noodle Bar
  offer('koen-noodle-bar', 'tonkotsu-ramen', 'Kōen Tonkotsu', 1695, '18-hour pork bone broth, chashu, ajitama egg.'),
  offer('koen-noodle-bar', 'spicy-chicken-ramen', 'Red Miso Chicken Ramen', 1395, 'Chicken paitan, red miso, chilli oil.'),
  offer('koen-noodle-bar', 'miso-vegetable-ramen', 'Garden Miso Ramen', 1295, 'White miso broth, crispy tofu, pak choi, corn.'),
  offer('koen-noodle-bar', 'chicken-karaage', 'Karaage Bites', 750, 'Ginger-soy chicken thigh, yuzu mayo.'),
  offer('koen-noodle-bar', 'chicken-katsu-curry', 'Katsu Curry Don', 1250, 'Panko chicken over rice, house curry sauce.'),
  // Umi Hand Roll
  offer('umi-hand-roll', 'sushi-platter', 'Omakase Hand Roll Set', 2400, 'Six chef’s-choice hand rolls, made in front of you.'),
  offer('umi-hand-roll', 'sushi-platter', 'Salmon & Tuna Sushi Box', 1850, 'Nigiri and maki, salmon, tuna and prawn.'),
  offer('umi-hand-roll', 'cold-soba', 'Chilled Yuzu Soba', 1150, 'Buckwheat noodles, yuzu kombu dip, spring onion.'),
  offer('umi-hand-roll', 'chicken-karaage', 'Umi Karaage', 995, 'Twice-fried chicken, shichimi, lemon.'),
  // Tsuru Katsu
  offer('tsuru-katsu', 'chicken-katsu-curry', 'Tsuru Chicken Katsu Curry', 1195, 'Thick-cut katsu, mild curry, pickles.'),
  offer('tsuru-katsu', 'chicken-karaage', 'Yuzu Karaage', 995, 'Citrusy fried chicken, Kewpie mayo.'),
  offer('tsuru-katsu', 'spicy-chicken-ramen', 'Tantan Chicken Ramen', 1350, 'Sesame-chilli broth, extra hot.', { axes: { spice: 4 } }),
  // Hanok House
  offer('hanok-house', 'korean-fried-chicken', 'Yangnyeom Chicken', 1395, 'Double-fried, sweet-spicy gochujang glaze.'),
  offer('hanok-house', 'bibimbap', 'Dolsot Bibimbap', 1650, 'Sizzling stone bowl, bulgogi beef, egg, gochujang.'),
  offer('hanok-house', 'bulgogi', 'Bulgogi Rice Plate', 1750, 'Pear-marinated beef, rice, banchan.'),
  offer('hanok-house', 'sundubu-jjigae', 'Seafood Sundubu', 1450, 'Silken tofu stew with clams, bubbling hot.'),
  // Seoul Fire
  offer('seoul-fire', 'korean-fried-chicken', 'Seoul Fire Wings', 1395, 'Our hottest glaze. You were warned.', { axes: { spice: 4 } }),
  offer('seoul-fire', 'buldak-noodles', 'Fire Chicken Noodles', 1250, 'Chewy noodles, fire sauce, melted cheese.'),
  offer('seoul-fire', 'sundubu-jjigae', 'Kimchi Sundubu', 1295, 'Soft tofu, kimchi, clams, egg.'),
  // Jade Lantern
  offer('jade-lantern', 'dan-dan-noodles', 'Sichuan Dan Dan', 1150, 'Hand-pulled noodles, pork, chilli oil, numbing pepper.'),
  offer('jade-lantern', 'mapo-tofu', 'Mapo Tofu (Vegan)', 1250, 'Silken tofu in fiery doubanjiang, rice.'),
  offer('jade-lantern', 'sweet-and-sour-chicken', 'Sweet & Sour Chicken', 1150, 'Crispy chicken, pineapple, peppers.'),
  offer('jade-lantern', 'vegetable-potstickers', 'Crispy Veg Potstickers', 650, 'Pan-fried, cabbage and shiitake.'),
  // Bamboo Steam
  offer('bamboo-steam', 'har-gow', 'Crystal Prawn Har Gow', 695, 'Four translucent prawn dumplings.'),
  offer('bamboo-steam', 'vegetable-potstickers', 'Pan-fried Veg Potstickers', 650, 'Garlic chive and mushroom, black vinegar.'),
  offer('bamboo-steam', 'char-siu-bao', 'Char Siu Bao', 595, 'Fluffy buns, sticky barbecue pork.'),
  offer('bamboo-steam', 'dan-dan-noodles', 'Dan Dan Noodles', 1095, 'Sesame, pork, chilli oil.'),
  // Wok Theory
  offer('wok-theory', 'sweet-and-sour-chicken', 'Sweet & Sour Chicken Box', 995, 'Crispy chicken, egg fried rice.'),
  offer('wok-theory', 'dan-dan-noodles', 'Chilli Oil Dan Dan', 1050, 'Numbing, nutty, a bit messy.'),
  offer('wok-theory', 'mapo-tofu', 'Mapo Tofu Rice', 1095, 'Vegan mapo tofu over jasmine rice.'),
  // Lemongrass & Lime
  offer('lemongrass-and-lime', 'pad-thai', 'Prawn Pad Thai', 1295, 'Tamarind, peanuts, lime, tiger prawns.'),
  offer('lemongrass-and-lime', 'thai-green-curry', 'Green Curry Chicken', 1350, 'Fresh green paste, Thai basil, jasmine rice.'),
  offer('lemongrass-and-lime', 'massaman-curry', 'Massaman Beef', 1695, 'Slow-cooked short rib, potato, peanuts.'),
  offer('lemongrass-and-lime', 'mango-sticky-rice', 'Mango Sticky Rice', 650, 'Coconut sticky rice, Nam Dok Mai mango.'),
  offer('lemongrass-and-lime', 'chicken-larb', 'Chicken Larb', 1095, 'Mint, toasted rice, lime, chilli.'),
  offer('lemongrass-and-lime', 'tom-yum', 'Tom Yum Goong', 1150, 'Hot and sour prawn soup.'),
  // Soi Seven
  offer('soi-seven', 'som-tam', 'Som Tam Thai', 895, 'Pounded green papaya, Thai-hot.'),
  offer('soi-seven', 'tom-yum', 'Tom Yum Seafood', 1195, 'Clear, sour, fiery.'),
  offer('soi-seven', 'pad-thai', 'Street Pad Thai', 1150, 'Wok-charred rice noodles, prawns.'),
  offer('soi-seven', 'chicken-larb', 'Isaan Larb Gai', 1050, 'The way they eat it in Isaan: very hot.'),
  offer('soi-seven', 'thai-green-curry', 'Jungle-style Green Curry', 1295, 'No coconut, all heat.', { axes: { spice: 4, richness: 2 } }),
  offer('soi-seven', 'mango-sticky-rice', 'Mango & Coconut Sticky Rice', 595, 'Salty-sweet coconut cream.'),
  // Mekong Table
  offer('mekong-table', 'beef-pho', 'Pho Bo Dac Biet', 1650, 'Rare steak, brisket, 12-hour broth.'),
  offer('mekong-table', 'tofu-pho', 'Pho Chay', 1195, 'Star anise vegetable broth, tofu, herbs.'),
  offer('mekong-table', 'summer-rolls', 'Prawn Summer Rolls', 750, 'Rice paper, prawns, mint, peanut dip.'),
  offer('mekong-table', 'banh-mi', 'Lemongrass Pork Banh Mi', 895, 'Crackly baguette, pickles, chilli.'),
  // Banh & Bun
  offer('banh-and-bun', 'banh-mi', 'Classic Banh Mi', 850, 'Pork, pâté, pickled veg, coriander.'),
  offer('banh-and-bun', 'summer-rolls', 'Rainbow Rolls', 695, 'Prawn and herb rolls, nuoc cham.'),
  offer('banh-and-bun', 'beef-pho', 'Weekend Pho', 1250, 'Beef pho, big bowl.'),
  // Saffron Row
  offer('saffron-row', 'butter-chicken', 'Butter Chicken', 1395, 'Charred tikka in a silky makhani sauce.'),
  offer('saffron-row', 'chicken-tikka-masala', 'Chicken Tikka Masala', 1350, 'The British classic, done properly.'),
  offer('saffron-row', 'lamb-biryani', 'Hyderabadi Lamb Biryani', 1795, 'Dum-cooked, saffron, crispy onions.'),
  offer('saffron-row', 'chana-masala', 'Chana Masala', 995, 'Tangy chickpea curry.'),
  offer('saffron-row', 'lamb-vindaloo', 'Lamb Vindaloo', 1650, 'Goan-style, vinegar and Kashmiri chilli.'),
  // Madras Social
  offer('madras-social', 'masala-dosa', 'Masala Dosa', 1050, 'Paper-thin crêpe, spiced potato, sambar.'),
  offer('madras-social', 'lamb-vindaloo', 'Goan-style Vindaloo', 1395, 'Hot, sour, garlicky.'),
  offer('madras-social', 'chana-masala', 'Pindi Chana', 950, 'Dark, dry-spiced chickpeas.'),
  offer('madras-social', 'butter-chicken', 'Makhani Chicken', 1350, 'Mild, rich, buttery.'),
  // Curry Leaf Canteen
  offer('curry-leaf-canteen', 'butter-chicken', 'Canteen Butter Chicken', 1250, 'Tomato, butter, fenugreek.'),
  offer('curry-leaf-canteen', 'chicken-tikka-masala', 'Tikka Masala', 1195, 'Creamy, mildly spiced.'),
  offer('curry-leaf-canteen', 'chana-masala', 'Chickpea Curry', 895, 'Vegan, with jeera rice.'),
  offer('curry-leaf-canteen', 'lamb-biryani', 'Lamb Dum Biryani', 1650, 'Sealed and slow-cooked.'),
  offer('curry-leaf-canteen', 'masala-dosa', 'Mysore Masala Dosa', 995, 'Red chutney, potato, sambar.'),
  // Cedar & Sumac
  offer('cedar-and-sumac', 'chicken-shawarma-wrap', 'Chicken Shawarma Wrap', 895, 'Toum, pickles, chips inside.'),
  offer('cedar-and-sumac', 'falafel-wrap', 'Falafel Wrap', 795, 'Crisp falafel, tahini, parsley.'),
  offer('cedar-and-sumac', 'mezze-platter', 'Mezze for One', 1450, 'Hummus, tabbouleh, halloumi, pitta.'),
  offer('cedar-and-sumac', 'chicken-shawarma-bowl', 'Shawarma Bowl', 1150, 'Chicken over fattoush, pomegranate.', { dietary: { glutenFree: false } }), // fattoush is made with toasted pitta
  // Za'atar Yard
  offer('zaatar-yard', 'falafel-wrap', 'Za’atar Falafel Wrap', 750, 'Za’atar flatbread, falafel, pickles.'),
  offer('zaatar-yard', 'chicken-shawarma-wrap', 'Garlic Chicken Shawarma', 850, 'Heavy on the toum.'),
  offer('zaatar-yard', 'chicken-shawarma-bowl', 'Chicken Fattoush Bowl', 1095, 'Crunchy salad, sumac, shawarma chicken.', { dietary: { glutenFree: false } }), // fattoush: toasted pitta
  offer('zaatar-yard', 'mezze-platter', 'Mezze Box', 1295, 'Dips, salads and warm pitta.'),
  // Anatolia Grill
  offer('anatolia-grill', 'adana-kebab', 'Adana Kebab Plate', 1795, 'Charcoal-grilled, pul biber, sumac onions.'),
  offer('anatolia-grill', 'doner-kebab', 'Lamb Doner Wrap', 950, 'Garlic sauce, chilli sauce, salad.'),
  offer('anatolia-grill', 'baklava', 'Pistachio Baklava', 550, 'Four pieces, still warm from the tray.'),
  // Simit Morning
  offer('simit-morning', 'turkish-eggs', 'Çılbır', 1095, 'Poached eggs, garlic yoghurt, chilli butter.'),
  offer('simit-morning', 'baklava', 'Walnut Baklava', 495, 'Walnut and cinnamon.'),
  // Forno Rosso
  offer('forno-rosso', 'margherita-pizza', 'Margherita', 1050, 'Fior di latte, basil, 48-hour dough.'),
  offer('forno-rosso', 'nduja-pizza', 'Nduja & Hot Honey', 1350, 'Spicy nduja, mozzarella, chilli honey.'),
  offer('forno-rosso', 'tiramisu', 'Tiramisu', 650, 'Mascarpone, espresso, cocoa.'),
  // Nonna Tina's
  offer('nonna-tinas', 'spaghetti-carbonara', 'Carbonara', 1650, 'Guanciale, egg yolk, pecorino. No cream.'),
  offer('nonna-tinas', 'penne-arrabbiata', 'Penne all’Arrabbiata', 1095, 'Tomato, garlic, a proper kick.'),
  offer('nonna-tinas', 'mushroom-risotto', 'Porcini Risotto', 1750, 'Carnaroli, porcini, aged parmesan.'),
  offer('nonna-tinas', 'tiramisu', 'Nonna’s Tiramisu', 700, 'Made every morning.'),
  offer('nonna-tinas', 'margherita-pizza', 'Pizza Margherita', 1150, 'Classic Neapolitan.'),
  // Olive & Oregano
  offer('olive-and-oregano', 'chicken-gyros', 'Chicken Gyros Pita', 950, 'Tzatziki, tomato, chips in the wrap.'),
  offer('olive-and-oregano', 'greek-salad', 'Horiatiki', 950, 'Feta slab, tomato, olives, oregano.'),
  offer('olive-and-oregano', 'moussaka', 'Moussaka', 1695, 'Aubergine, spiced lamb, thick béchamel.'),
  // Casa Brava
  offer('casa-brava', 'seafood-paella', 'Seafood Paella', 1995, 'Saffron rice, prawns, mussels, crispy socarrat.'),
  offer('casa-brava', 'patatas-bravas', 'Patatas Bravas', 650, 'Smoked paprika sauce, aioli.'),
  offer('casa-brava', 'churros-chocolate', 'Churros con Chocolate', 695, 'Cinnamon sugar, thick hot chocolate.'),
  // The Copper Kettle
  offer('the-copper-kettle', 'fish-and-chips', 'Beer-battered Haddock & Chips', 1795, 'Mushy peas, tartare sauce.'),
  offer('the-copper-kettle', 'steak-and-ale-pie', 'Steak & Ale Pie', 1850, 'Shortcrust, mash, gravy.'),
  offer('the-copper-kettle', 'bangers-and-mash', 'Bangers & Mash', 1295, 'Pork sausages, onion gravy.'),
  offer('the-copper-kettle', 'sticky-toffee-pudding', 'Sticky Toffee Pudding', 695, 'With custard or clotted cream.'),
  // Morning Ground Café
  offer('morning-ground-cafe', 'full-english', 'The Full English', 1250, 'Bacon, sausage, eggs, beans, toast.'),
  offer('morning-ground-cafe', 'avocado-eggs-sourdough', 'Smashed Avo & Poached Eggs', 1095, 'Sourdough, chilli, lime.'),
  offer('morning-ground-cafe', 'buttermilk-pancakes', 'Buttermilk Stack', 1050, 'Maple, berries, whipped butter.'),
  offer('morning-ground-cafe', 'turkish-eggs', 'Turkish Eggs on Sourdough', 1150, 'Garlic yoghurt, chilli butter.', { dietary: { glutenFree: false } }), // served on sourdough
  // The Sticky Spoon
  offer('the-sticky-spoon', 'sticky-toffee-pudding', 'Sticky Toffee Pud & Custard', 750, 'A big portion.'),
  offer('the-sticky-spoon', 'steak-and-ale-pie', 'Steak & Ale Pie Box', 1395, 'Pie, mash, peas, gravy.'),
  offer('the-sticky-spoon', 'fish-and-chips', 'Cod & Chips', 1350, 'Crisp batter, salt and vinegar.'),
  // Smash & Co.
  offer('smash-and-co', 'smash-cheeseburger', 'Double Smash', 1650, 'Two patties, American cheese, fries.'),
  offer('smash-and-co', 'plant-smash-burger', 'Plant Smash', 1295, 'Plant patty, vegan cheese, burger sauce.'),
  offer('smash-and-co', 'mac-and-cheese', 'Truffle Mac', 950, 'Three cheeses, truffle, crumb.', { axes: { adventurousness: 1 } }),
  offer('smash-and-co', 'nashville-hot-chicken', 'Hot Chicken Sando Plate', 1250, 'Nashville-hot tenders, pickles, slaw.'),
  // Hot Coop
  offer('hot-coop', 'nashville-hot-chicken', 'Nashville Hot Tenders', 1250, 'Choose your heat. We chose hot.'),
  offer('hot-coop', 'buffalo-cauliflower', 'Buffalo Cauli Bites', 850, 'Vegan ranch dip.'),
  offer('hot-coop', 'mac-and-cheese', 'Mac & Cheese', 750, 'Gooey, crumb-topped.'),
  offer('hot-coop', 'korean-fried-chicken', 'Korean Hot Wings', 1150, 'Gochujang glaze, extra hot.', { axes: { spice: 4 } }),
  // Aloha Bowl Co.
  offer('aloha-bowl-co', 'tuna-poke-bowl', 'Ahi Tuna Poke', 1295, 'Shoyu tuna, sushi rice, edamame.'),
  offer('aloha-bowl-co', 'tuna-poke-bowl', 'Salmon & Tuna Poke', 1695, 'Double fish, avocado, furikake.'),
  offer('aloha-bowl-co', 'chicken-caesar-salad', 'Chicken Caesar Bowl', 1150, 'Grilled chicken, parmesan, croutons.'),
  // Stack Diner
  offer('stack-diner', 'buttermilk-pancakes', 'Buttermilk Pancakes', 995, 'Maple syrup and berries.'),
  offer('stack-diner', 'smash-cheeseburger', 'Diner Cheeseburger', 1195, 'Griddled, cheese, pickles.'),
  offer('stack-diner', 'chicken-caesar-salad', 'Caesar Salad with Chicken', 1250, 'Classic dressing, anchovy croutons.'),
  offer('stack-diner', 'mac-and-cheese', 'Stovetop Mac', 895, 'Cheddar sauce, black pepper.'),
  // Taquería Luz
  offer('taqueria-luz', 'birria-tacos', 'Birria Tacos & Consomé', 1650, 'Braised beef, melted cheese, dip.'),
  offer('taqueria-luz', 'fish-tacos', 'Baja Fish Tacos', 1150, 'Beer-battered cod, slaw, chipotle crema.'),
  offer('taqueria-luz', 'sea-bass-ceviche', 'Sea Bass Ceviche', 1095, 'Lime, jalapeño, tostadas.'),
  // Burrito Norte
  offer('burrito-norte', 'chicken-burrito', 'Chicken Burrito', 1050, 'Chipotle chicken, rice, beans, crema.'),
  offer('burrito-norte', 'black-bean-burrito-bowl', 'Black Bean Bowl', 995, 'Lime rice, pico, guacamole.'),
  offer('burrito-norte', 'fish-tacos', 'Fish Taco Trio', 1050, 'Three tacos, pickled onion.'),
  offer('burrito-norte', 'birria-tacos', 'Birria Tacos', 1295, 'Four tacos, consomé.'),
  // Scotch Bonnet Kitchen
  offer('scotch-bonnet-kitchen', 'jerk-chicken', 'Jerk Chicken, Rice & Peas', 1350, 'Pimento-smoked, festival on the side.', { dietary: { glutenFree: false } }), // festival: a fried flour dumpling
  offer('scotch-bonnet-kitchen', 'curry-mutton', 'Curry Mutton', 1695, 'On the bone, slow-cooked.'),
  offer('scotch-bonnet-kitchen', 'ital-stew', 'Ital Stew', 1150, 'Coconut, beans, pumpkin, thyme.'),
  // Island Morning
  offer('island-morning', 'ackee-and-saltfish', 'Ackee & Saltfish', 1250, 'Fried dumplings, plantain.', { dietary: { glutenFree: false } }), // fried dumplings are made with flour
  offer('island-morning', 'jerk-chicken', 'Quarter Jerk Chicken', 1195, 'Rice & peas, slaw.'),
  offer('island-morning', 'ital-stew', 'Ital Stew Bowl', 1050, 'Rice, stew, greens.'),
  // Ọ̀nà Kitchen
  offer('ona-kitchen', 'jollof-rice', 'Party Jollof & Chicken', 1395, 'Smoky jollof, grilled chicken, plantain.'),
  offer('ona-kitchen', 'egusi-soup', 'Egusi & Pounded Yam', 1795, 'Melon seed, spinach, smoked fish.'),
  offer('ona-kitchen', 'chicken-pepper-soup', 'Chicken Pepper Soup', 1195, 'Peppery, aromatic, restorative.'),
  offer('ona-kitchen', 'puff-puff', 'Puff-Puff', 550, 'Six pieces, nutmeg sugar.'),
  offer('ona-kitchen', 'beef-suya', 'Suya Platter', 1450, 'Charcoal beef, yaji spice, onions, tomato.'),
  offer('ona-kitchen', 'red-red', 'Red-Red', 1150, 'Black-eyed bean stew, sweet fried plantain.'),
  // Kumasi Corner
  offer('kumasi-corner', 'red-red', 'Red-Red & Plantain', 1095, 'Black-eyed beans in palm oil, sweet plantain.'),
  offer('kumasi-corner', 'jollof-rice', 'Jollof Rice & Chicken', 1250, 'With shito on the side.'),
  offer('kumasi-corner', 'beef-suya', 'Beef Suya', 1250, 'Yaji-spiced skewers, onion, tomato.'),
  offer('kumasi-corner', 'puff-puff', 'Puff-Puff & Chilli Honey', 595, 'Sweet, hot, sticky.', { dietary: { vegan: false } }), // chilli honey; still vegetarian
]
