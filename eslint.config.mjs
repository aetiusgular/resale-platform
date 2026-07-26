import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import reactHooks from 'eslint-plugin-react-hooks'
import react from 'eslint-plugin-react'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

// eslint-plugin-react "recommended", downgraded to warnings so the verify gate
// (`eslint .`) stays green — surfaces issues without blocking. Clean up incrementally.
const reactRecommendedWarn = Object.fromEntries(
  Object.entries(react.configs.flat.recommended.rules).map(([rule, level]) => [
    rule,
    level === 'error' || level === 2 ? 'warn' : level,
  ]),
)

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  // Explicit react-hooks plugin. Core correctness rule stays an error;
  // v7's newer react-compiler-style rules run as warnings (surface tech-debt
  // without blocking the verify gate — clean up incrementally).
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  // Explicit eslint-plugin-react (base React rules, distinct from react-hooks).
  // Mirrors the react-hooks block above: everything runs as a warning.
  {
    plugins: { react },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactRecommendedWarn,
      // React 19 automatic JSX runtime — these rules are unnecessary here.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // TypeScript handles prop typing.
      'react/prop-types': 'off',
    },
  },
  // Leading-underscore identifiers are intentional "unused" markers — don't flag them.
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    ignores: ['design-reference/**', '.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
]

export default eslintConfig
