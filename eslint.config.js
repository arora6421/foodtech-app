import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

// Architectural boundaries (MVP_SPEC §15). Each layer lists what it must NOT import.
const layer = (...folders) => folders.map((f) => [`**/${f}/**`, `../${f}/*`, `../../${f}/*`, `./${f}/*`]).flat()

const restrict = (groups, message) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: groups, message }] }],
})

// The engine must be deterministic: no clock, no ambient randomness, no browser.
const purity = {
  'no-restricted-globals': [
    'error',
    ...['window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'fetch', 'process'].map((name) => ({
      name,
      message: 'The engine is pure: inject this dependency instead.',
    })),
  ],
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: 'Use the seeded RNG in engine/rng.ts.' },
    { object: 'Date', property: 'now', message: 'Take `now` from SessionContext.' },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
      message: 'Take `now` from SessionContext.',
    },
  ],
}

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'sim-output', '.compare'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      ...restrict(
        ['react', 'react-dom', '@supabase/*', ...layer('engine', 'catalog', 'location', 'analytics', 'app', 'sync', 'sim')],
        'domain/ imports nothing internal.',
      ),
      ...purity,
    },
  },
  {
    files: ['src/engine/**/*.ts'],
    ignores: ['src/engine/**/*.test.ts'],
    rules: {
      ...restrict(
        ['react', 'react-dom', '@supabase/*', 'zustand', ...layer('catalog', 'location', 'analytics', 'app', 'sync', 'sim')],
        'engine/ may import only domain/ (MVP_SPEC §15).',
      ),
      ...purity,
    },
  },
  {
    files: ['src/engine/**/*.test.ts'],
    rules: restrict(['react', 'react-dom', '@supabase/*', ...layer('app', 'sync')], 'Engine tests stay UI- and network-free.'),
  },
  {
    files: ['src/catalog/**/*.ts', 'src/location/**/*.ts'],
    rules: restrict(['react', 'react-dom', '@supabase/*', ...layer('engine', 'app', 'sync', 'sim')], 'Data layers depend only on domain/.'),
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...restrict(['@supabase/*', ...layer('sim')], 'Only src/sync/supabase may import Supabase; the app never imports sim/.'),
    },
  },
  {
    // M1: presentational layers never touch the engine, catalogue or sim directly; only app/state,
    // app/services and app/debug may (docs/m1-spec.md §0, §3.2).
    files: ['src/app/{screens,components,hooks,routes,design,copy}/**/*.{ts,tsx}'],
    rules: restrict(
      ['@supabase/*', ...layer('sim', 'engine', 'catalog', 'sync')],
      'Presentational code uses view models from app/state; only app/state and app/services talk to the engine.',
    ),
  },
  {
    files: ['src/sim/**/*.ts', '*.config.{js,ts}', 'docs/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // The perf script ships functions into the page (page.evaluate), which run in the browser.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
)
