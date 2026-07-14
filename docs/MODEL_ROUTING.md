# MODEL_ROUTING.md — QA-phase token policy (July 2026)

Context: alpha build complete; we are in QA/polish. The interactive /model
switcher has a UI bug, so routing is enforced where it actually binds:
CLI flags on headless runs, project settings default, and subagent
frontmatter. Nobody should ever need /model.

## Intensity rubric (choose the model per headless run)

| Intensity | Examples | Model flag |
|---|---|---|
| TRIVIAL | copy/CSS tweaks, single-file fix, config change, key-prop bugs | `--model haiku` |
| STANDARD | multi-file feature or fix + tests (typical HF batch) | `--model haiku` first; escalate to sonnet only if the haiku run fails its gate |
| SENSITIVE | anything touching auth, money, RLS, webhooks | `--model sonnet` (never haiku), critical reviewer mandatory |
| ARCHITECTURAL | new subsystem (e.g. BR1–BR4 recommendations) | two-stage: PLAN run then EXECUTE run (below) |

## Two-stage pattern for architectural work
1. PLAN run: `claude -p "<prompt> — PLAN ONLY: read the whitelisted files,
   write docs/PLAN-<id>.md (approach, files, schemas, risks, test list).
   Do NOT modify code." --model opus --allowedTools "Read,Glob,Grep,Write"`
   Use fable instead of opus ONLY for genuinely novel/ambiguous design
   questions (new product surface, unclear tradeoffs) — not for applying
   established patterns.
2. EXECUTE run: `--model sonnet` (haiku if the plan turned out small),
   prompt = "implement docs/PLAN-<id>.md exactly; deviations require a
   PLAN-DEVIATION note in HANDOFF."

## Subagent models (frontmatter, set in .claude/agents/)
- code-reviewer — sonnet (QA-phase default)
- code-reviewer-critical — opus; MANDATORY for diffs touching auth, money,
  RLS, webhooks; invoked by name in SENSITIVE prompts
- db-guard — haiku; escalate any money-table migration to code-reviewer-critical
- ui-verifier — haiku (screenshot comparison is mechanical)

## Session defaults
- .claude/settings.json pins "model": "sonnet" → interactive sessions start
  there without /model; start cheaper sessions from the CLI: `claude --model haiku`.
- Headless: ALWAYS pass --model explicitly; never rely on defaults.
- Verification gates (pnpm verify / verify:ui) are model-free — never skip
  them to save tokens; they're the cheap part.

## Escalation rule (the only judgment call)
Start low. A failed gate on haiku = rerun the SAME prompt on sonnet with
"previous attempt's diff is on disk; assess, fix, complete." Never burn a
third run — third failure means the prompt is wrong, not the model; stop
and rewrite the prompt.
