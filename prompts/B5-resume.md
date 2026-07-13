# B5 RESUME — prior session hit usage limits mid-build

CONTEXT: A previous headless session was executing prompts/B5.md (checkout +
escrow + seller protection — the money milestone) and was cut off by usage
limits partway through. Its partial work was committed as
"wip(B5): partial checkout/escrow work" (27 files: orders migration,
lib/orders.ts, lib/stripe.ts, service client, payout gating, and more).
docs/HANDOFF.md still says B4 COMPLETE — trust the git diff over HANDOFF.

YOUR JOB:
1. Read prompts/B5.md in full — it remains the authoritative spec, including
   RUN CONTEXT (stripe CLI --api-key usage, bounded background `stripe
   listen`, anti-hang rules), all 10 TASKS, the full VERIFY list, and FINISH.
2. Diff the wip commit against B4 (git show --stat b8d2b64; read the files)
   to map what exists vs what's missing. Do NOT rewrite working code.
3. Complete the remaining tasks, run the ENTIRE verify suite (including on
   code from the wip commit — it was never verified), mandatory code-reviewer
   AND db-guard passes on the full B5 diff (wip + new).
4. FINISH per B5.md; fold the wip commit story into one clean summary.
   If usage limits hit again: commit wip immediately with a one-line status
   in docs/HANDOFF.md ("B5 wip #2 — resume point: <task>"), do not thrash.
