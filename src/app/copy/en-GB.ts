import type { Budget, DietConstraint, Fulfilment, Mood } from '../../domain'

// Every user-facing string (m1-spec §2.1). UK English, sentence case, plain.
// The product name is a neutral placeholder in ONE place and is not part of the design system.

export const PRODUCT_NAME = 'working title'

export const copy = {
  welcome: {
    title: 'Hungry, but not sure',
    titleEmphasis: 'what for?',
    body: "Swipe a few dishes and we'll work out what you want.",
    primary: 'Just me',
    secondary: 'Saved dishes',
    loading: 'Getting the menu ready…',
    loadError: "We couldn't load the dishes. Please refresh the page.",
  },
  craving: {
    step: 'Step 1 of 2',
    title: 'What do you feel like',
    titleEmphasis: 'eating?',
    body: 'Pick up to two, or skip.',
    or: 'or',
    somethingNew: 'Something new',
    noIdea: 'No idea',
    primary: 'Show me dishes',
    back: 'Back',
    diet: 'Diet',
    budget: 'Budget',
    eating: 'Eating',
    tooTight: (n: number) =>
      `Only ${n} ${n === 1 ? 'dish fits' : 'dishes fit'} these settings, so there's less to choose from. You can still carry on.`,
    none: 'No dishes match these settings. Try a wider budget or a different eating option.',
  },
  moods: {
    spicy: 'Spicy',
    comforting: 'Comforting',
    carby: 'Carby',
    fresh: 'Fresh',
    indulgent: 'Indulgent',
    warm_soupy: 'Warm & soupy',
    sweet: 'Sweet',
  } satisfies Record<Mood, string>,
  diet: {
    none: 'None',
    vegetarian: 'Vegetarian',
    vegan: 'Vegan',
    pescatarian: 'Pescatarian',
    no_pork: 'No pork',
    gluten_free: 'Gluten-free',
  } satisfies Record<DietConstraint | 'none', string>,
  budget: { any: 'Any', low: 'Up to £10', mid: 'Up to £16', high: 'Up to £25' } satisfies Record<Budget, string>,
  fulfilment: { either: 'Either', delivery: 'Delivery', go_out: 'Going out' } satisfies Record<Fulfilment, string>,
  sheets: {
    dietTitle: 'Diet',
    dietBody:
      'We only show dishes that fit. Allergens are shown only when a venue lists them; always check with the venue.',
    budgetTitle: 'Budget',
    eatingTitle: 'Eating',
    done: 'Done',
    close: 'Close',
  },
  deck: {
    undo: 'Undo',
    decide: 'Decide for me',
    left: 'left',
    nope: 'Nope',
    yes: 'Yes',
    theOne: "That's the one",
    cardHint: 'Arrow right for yes, arrow left for nope, Enter for that’s the one.',
    heading: (name: string, n: number) => `${name}, card ${n}`,
    announce: (n: number, label: string, left: number) => `Card ${n}. ${label} ${left} dishes left.`,
    spice: (n: number, word: string) => `Spice ${n} of 4, ${word.toLowerCase()}`,
    allergens: 'Listed allergens',
  },
  match: {
    title: 'Match found',
    why: 'Why this one',
    orTry: 'Or try',
    ourMatch: 'Our match',
    alsoAt: 'Also at',
    order: 'Order',
    directions: 'Directions',
    save: 'Save',
    saved: 'Saved',
    somethingElse: 'Show me something else',
    startAgain: 'Start again',
    pickTitle: 'Pick one of these',
    pickBody: 'None of our picks landed, so here are the closest five.',
    // Runner-up inspection (approved copy: "Alternative")
    altLabel: 'Alternative',
    altWhy: 'Why it could suit you',
    altChoose: 'Choose this instead',
    altReturn: 'Return to our match',
    // Pick-list sessions only (none of our picks landed, so there is no "our match" to return to).
    pickListReturn: 'Back to the list',
    pickListTop: 'Top of the list',
  },
  error: {
    title: 'Something went wrong',
    body: 'Sorry, that screen didn’t load. Starting again usually fixes it.',
    restart: 'Start again',
  },
  imagery: {
    illustrative: 'Illustrative image',
  },
  handoff: {
    orderTitle: (venue: string) => `Order from ${venue}`,
    orderBody: 'Choose a delivery app.',
    directionsTitle: (venue: string) => `Directions to ${venue}`,
    openMaps: 'Open in Maps',
    prototype: 'Prototype: this isn’t connected yet. In the real app it would open the app you choose.',
    mapsPrototype: 'Prototype: this isn’t connected yet. In the real app it would open your maps app.',
    opened: (platform: string, venue: string) => `In the real app, this would open ${platform} at ${venue}.`,
    mapsOpened: 'In the real app, this would open your maps app with walking directions.',
  },
  saved: {
    title: 'Saved dishes',
    empty: 'Nothing saved yet. Save a match and it will appear here.',
    remove: 'Remove',
    back: 'Back',
    savedOn: (date: string) => `Saved ${date}`,
    missing: 'That saved dish is no longer here.',
  },
  empty: {
    noCards: "We've run out of dishes to show you. Here's our best guess.",
  },
} as const
