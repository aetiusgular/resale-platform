# resale-platform (working name TBD)

Curated, virtually-free secondhand luxury marketplace. Alpha build.

## Start here
1. `.env.local` — paste your keys (names per `docs/SETUP_CHECKLIST.md` §3). Never committed.
2. Preflight: `docs/SETUP_CHECKLIST.md` §5 must be green.
3. Build sequence: `docs/BUILD_PROMPTS.md` — run B0 in Claude Code from this directory
   (Plan Mode on fable → execute on sonnet). B0 scaffolds Next.js, extracts design
   tokens from the design exports, and sets up the verify harness.
4. After B0: `claude mcp add playwright -- npx @playwright/mcp@latest` (project-scoped).

Planning docs live in `docs/`. Design exports are copied to `design-reference/` by B0.
