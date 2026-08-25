/**
 * generate-legal.mjs — regenerates the /terms and /privacy page content from the
 * legal source-of-truth markdown in docs/legal/.
 *
 *   docs/legal/TERMS_OF_SERVICE.md → app/terms/content.ts   (TERMS_HTML)
 *   docs/legal/PRIVACY_POLICY.md   → app/privacy/content.ts (PRIVACY_HTML)
 *
 * Run from the repo root:  node scripts/generate-legal.mjs
 * One-time prerequisite:   pnpm add -D marked
 *
 * What it does beyond plain markdown → HTML:
 *  - rewrites the docs' [DOMAIN]/fees and [DOMAIN]/privacy links to the app routes
 *  - wraps bracketed [PLACEHOLDER] tokens (and [Counsel: …] flags) in <mark> so
 *    unfilled fields render in alert color and cannot be missed
 *  - escapes the HTML for embedding in a TypeScript template literal
 */
import fs from 'node:fs'
import path from 'node:path'

let marked
try {
  ;({ marked } = await import('marked'))
} catch {
  console.error('marked is not installed. Run: pnpm add -D marked')
  process.exit(1)
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

function convert(mdRel, exportName, outRel) {
  const mdPath = path.join(ROOT, mdRel)
  const outPath = path.join(ROOT, outRel)
  const md = fs
    .readFileSync(mdPath, 'utf8')
    .replaceAll(']([DOMAIN]/fees)', '](/fees)')
    .replaceAll(']([DOMAIN]/privacy)', '](/privacy)')
  let html = marked.parse(md, { gfm: true, async: false })
  html = html.replace(/\[([A-Z][^\[\]\n]{0,200})\]/g, '<mark>[$1]</mark>')
  html = html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
  const banner = `// GENERATED FILE — do not edit by hand.\n// Source of truth: ${mdRel}\n// Regenerate: node scripts/generate-legal.mjs   (one-time: pnpm add -D marked)\n\n`
  fs.writeFileSync(outPath, `${banner}export const ${exportName}: string = \`${html}\`\n`)
  console.log(`${outRel}  ${fs.statSync(outPath).size} bytes`)
}

convert('docs/legal/TERMS_OF_SERVICE.md', 'TERMS_HTML', 'app/terms/content.ts')
convert('docs/legal/PRIVACY_POLICY.md', 'PRIVACY_HTML', 'app/privacy/content.ts')
