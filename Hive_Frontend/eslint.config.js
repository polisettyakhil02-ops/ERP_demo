import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `.kilo/worktrees/*` are tool-created git worktrees - detached snapshots of
  // other commits living inside this one. Linting them reports that commit's
  // problems as if they were current.
  globalIgnores(['dist', 'dist-ssr', 'node_modules', '.kilo']),

  // The app itself is .jsx - this block is the one that matters day to day.
  // It was previously missing entirely (only ts/tsx was linted, i.e. the
  // shadcn primitives and utils.ts), which is how `gradeLabel` shipped
  // unimported into StudentReceipt.jsx and blanked the page at runtime:
  // Vite resolves modules, not identifiers, so only no-undef catches that.
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended, reactHooks.configs['recommended-latest']],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { react },
    rules: {
      // The bug class above. Non-negotiable.
      'no-undef': 'error',
      // Without these two, no-unused-vars cannot see that an identifier is
      // used inside JSX, and flags every imported component and icon as
      // unused - ~1000 false positives that bury the real ones.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      // Unused vars are noisy on a codebase this size and never break a page -
      // warn so they surface without failing `npm run lint --quiet`.
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `catch (error) {}` and similar are used deliberately in places.
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // Config files and anything else that runs in Node rather than the browser.
  {
    files: ['*.config.{js,ts}', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },

  // Must stay LAST: flat config applies in order, so this has to come after
  // the ts/tsx block that pulls in reactRefresh.configs.vite, or that block
  // turns the rule back on.
  //
  // shadcn primitives are vendored third-party code and follow the upstream
  // pattern of exporting a variants object (buttonVariants, badgeVariants,
  // ...) next to the component. That trips react-refresh/only-export-components,
  // which is a hot-reload ergonomics rule, not a correctness one - rewriting
  // vendored files to satisfy it would only make the next `shadcn add` conflict.
  {
    files: ['src/components/ui/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
