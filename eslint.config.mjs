import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import reactHooks from 'eslint-plugin-react-hooks'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

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
  {
    ignores: ['design-reference/**', '.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
]

export default eslintConfig
