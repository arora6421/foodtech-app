// Cover colours ("Crave"): each dish is printed on a bold version of its catalogue tint. The
// catalogue tint is set per format (noodles, curry, pizza…), so this maps those 16 tints. The
// four from the design mockups are exact; the rest were chosen to match them in weight. Every one
// keeps ink text at AA or better, grain included (src/app/services/contrast.test.ts).

export const COVERS: Readonly<Record<string, string>> = {
  '#c8894a': '#f2b441', // noodles: saffron (mockup)
  '#6f9a4a': '#b9cc8e', // salads and bowls: sage (mockup)
  '#b5651d': '#e98a4f', // curries and stews: orange (mockup)
  '#c0472b': '#eda48e', // pizza and flatbreads: pink (mockup)
  '#d9b36c': '#efd27a', // rice: butter
  '#c9783c': '#f0a35e', // soups: amber
  '#8c5a2b': '#d9a574', // burgers: toast
  '#c9a26b': '#e6c38c', // sandwiches and wraps: wheat
  '#e0b85a': '#f7cf5f', // pasta: yolk
  '#b86b3a': '#e99a6b', // tacos and burritos: terracotta
  '#e8d9b8': '#e4c98f', // dumplings and buns: steamed bun
  '#9b4a22': '#de8c66', // grills: char
  '#b98a4e': '#e2b37a', // small plates: mezze
  '#a8692d': '#dca15f', // pies and bakes: crust
  '#d6a44c': '#f3c45a', // breakfast: sunny
  '#6b3b24': '#d9a0a6', // desserts: rose
}

/** The fallback for a tint the map doesn't know yet: saffron, the house colour. */
export const DEFAULT_COVER = '#f2b441'

export const coverFor = (tint: string) => COVERS[tint.toLowerCase()] ?? DEFAULT_COVER
