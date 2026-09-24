import type { Cuisine, GeoPoint, HandoffTarget, Venue } from '../../domain'
import { ANGEL_N1 } from '../../location/LocationProvider'

// Fictional venues placed around Angel, N1 (MVP_SPEC §13.3–13.4).
// Names and streets are invented; none should match a real London restaurant.

/** A point `miles` from the mock origin on a compass bearing, rounded to ~1 m. */
function at(miles: number, bearingDeg: number): GeoPoint {
  const R = 3958.8
  const rad = (d: number) => (d * Math.PI) / 180
  const d = miles / R
  const θ = rad(bearingDeg)
  const φ1 = rad(ANGEL_N1.lat)
  const λ1 = rad(ANGEL_N1.lng)
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ))
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2))
  const round = (x: number) => Math.round(((x * 180) / Math.PI) * 1e5) / 1e5
  return { lat: round(φ2), lng: round(λ2) }
}

type Service = 'both' | 'delivery_only' | 'dine_in_only'

function venue(
  id: string,
  name: string,
  cuisine: Cuisine,
  miles: number,
  bearing: number,
  service: Service,
  addressLine: string,
): Venue {
  const offersDelivery = service !== 'dine_in_only'
  const dineIn = service !== 'delivery_only'
  const handoff: HandoffTarget[] = [
    ...(offersDelivery
      ? ([
          { kind: 'delivery_platform', label: 'Deliveroo' },
          { kind: 'delivery_platform', label: 'Uber Eats' },
        ] as const)
      : []),
    ...(dineIn ? ([{ kind: 'maps', label: 'Maps' }] as const) : []),
  ]
  return { id, name, cuisine, location: at(miles, bearing), addressLine, offersDelivery, dineIn, handoff }
}

export const VENUES: Venue[] = [
  venue('koen-noodle-bar', 'Kōen Noodle Bar', 'japanese', 0.4, 45, 'both', '12 Lantern Yard, N1'),
  venue('umi-hand-roll', 'Umi Hand Roll', 'japanese', 0.9, 270, 'dine_in_only', '3 Copperleaf Row, N1'),
  venue('tsuru-katsu', 'Tsuru Katsu', 'japanese', 1.8, 180, 'delivery_only', 'Unit 4, Wharfside Kitchens, EC1'),
  venue('hanok-house', 'Hanok House', 'korean', 0.6, 90, 'both', '41 Tenter Lane, N1'),
  venue('seoul-fire', 'Seoul Fire', 'korean', 2.2, 135, 'delivery_only', 'Unit 9, Wharfside Kitchens, EC1'),
  venue('jade-lantern', 'Jade Lantern', 'chinese', 1.2, 225, 'both', '88 Mercer Walk, WC1'),
  venue('bamboo-steam', 'Bamboo Steam', 'chinese', 0.7, 315, 'dine_in_only', '6 Pennyroyal Street, N1'),
  venue('wok-theory', 'Wok Theory', 'chinese', 3.3, 220, 'delivery_only', 'Unit 2, Southbank Dark Kitchens, SE1'),
  venue('lemongrass-and-lime', 'Lemongrass & Lime', 'thai', 0.5, 0, 'both', '19 Fennel Street, N1'),
  venue('soi-seven', 'Soi Seven', 'thai', 2.8, 40, 'delivery_only', 'Unit 7, Hackney Wick Kitchens, E9'),
  venue('mekong-table', 'Mekong Table', 'vietnamese', 1.1, 100, 'both', '27 Dyer’s Passage, EC1'),
  venue('banh-and-bun', 'Banh & Bun', 'vietnamese', 1.6, 350, 'delivery_only', '2 Oriel Mews, N7'),
  venue('saffron-row', 'Saffron Row', 'indian', 0.8, 170, 'both', '54 Cardamom Terrace, EC1'),
  venue('madras-social', 'Madras Social', 'indian', 2.0, 260, 'both', '11 Tamarind Court, WC1'),
  venue('curry-leaf-canteen', 'Curry Leaf Canteen', 'indian', 3.2, 10, 'both', '140 Holloway Parade, N19'),
  venue('cedar-and-sumac', 'Cedar & Sumac', 'lebanese', 0.3, 140, 'both', '7 Olive Court, N1'),
  venue('zaatar-yard', 'Za’atar Yard', 'lebanese', 1.9, 60, 'delivery_only', 'Unit 3, Mare Street Kitchens, E8'),
  venue('anatolia-grill', 'Anatolia Grill', 'turkish', 1.4, 20, 'both', '63 Coalport Road, N1'),
  venue('simit-morning', 'Simit Morning', 'turkish', 1.0, 30, 'dine_in_only', '15 Poppyseed Lane, N1'),
  venue('forno-rosso', 'Forno Rosso', 'italian', 0.6, 210, 'both', '22 Kiln Street, EC1'),
  venue('nonna-tinas', 'Nonna Tina’s', 'italian', 1.3, 280, 'both', '9 Vellum Place, WC1'),
  venue('olive-and-oregano', 'Olive & Oregano', 'greek', 2.4, 300, 'both', '31 Thyme Street, NW1'),
  venue('casa-brava', 'Casa Brava', 'spanish', 0.9, 120, 'dine_in_only', '5 Tile Kiln Yard, EC1'),
  venue('the-copper-kettle', 'The Copper Kettle', 'british', 0.5, 250, 'both', '1 Tinsmith’s Row, N1'),
  venue('morning-ground-cafe', 'Morning Ground Café', 'british', 0.2, 5, 'dine_in_only', '44 Chapelgate, N1'),
  venue('the-sticky-spoon', 'The Sticky Spoon', 'british', 3.0, 190, 'delivery_only', 'Unit 6, Southbank Dark Kitchens, SE1'),
  venue('smash-and-co', 'Smash & Co.', 'american', 0.8, 80, 'both', '18 Griddle Lane, N1'),
  venue('hot-coop', 'Hot Coop', 'american', 2.6, 95, 'delivery_only', 'Unit 1, Hackney Wick Kitchens, E9'),
  venue('aloha-bowl-co', 'Aloha Bowl Co.', 'american', 1.7, 230, 'both', '12 Reef Street, WC1'),
  venue('stack-diner', 'Stack Diner', 'american', 1.1, 160, 'both', '70 Chrome Avenue, EC1'),
  venue('taqueria-luz', 'Taquería Luz', 'mexican', 0.7, 340, 'both', '8 Marigold Street, N1'),
  venue('burrito-norte', 'Burrito Norte', 'mexican', 2.1, 150, 'both', '25 Adobe Walk, EC2'),
  venue('scotch-bonnet-kitchen', 'Scotch Bonnet Kitchen', 'caribbean', 1.45, 50, 'both', '13 Pimento Road, N1'),
  venue('island-morning', 'Island Morning', 'caribbean', 1.2, 70, 'dine_in_only', '2 Breadfruit Mews, N1'),
  venue('ona-kitchen', 'Ọ̀nà Kitchen', 'west_african', 2.3, 110, 'both', '36 Palmwine Street, E2'),
  venue('kumasi-corner', 'Kumasi Corner', 'west_african', 3.8, 35, 'delivery_only', 'Unit 5, Hackney Wick Kitchens, E9'),
]
