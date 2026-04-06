RIPER-5 structured development workflow — prevents premature coding and context waste.

TRIGGER when: user says "zacznijmy nową funkcję", "nowe zadanie", "chcę zbudować X", or starts any non-trivial feature that isn't a simple bugfix. Also trigger explicitly with /riper.

## The 5 Modes

**RESEARCH** (read-only) — understand before touching code
- Read relevant files, grep for patterns, check existing implementations
- Output: findings summary, what exists, what's missing
- NEVER write code in this phase

**INNOVATE** (read-only) — design options
- Propose 2-3 approaches with trade-offs
- Consider: performance, simplicity, maintainability, cost
- Pick the best — always the most effective, not the prettiest
- Output: recommended approach with reasoning

**PLAN** — write the spec
- Break into specific files + changes + order of implementation
- Identify reuse opportunities (existing utils, patterns, components)
- Save to .claude/plans/ if complex (>3 files)
- Output: step-by-step implementation list

**EXECUTE** — implement the approved plan
- Follow the plan exactly
- One file at a time, run tsc check between steps
- No improvising outside the plan without flagging it

**REVIEW** — validate
- Run: npm run build (MUST be green)
- Check: does it solve the original requirement?
- Check: did we introduce any security issues? any dead code?
- Output: test checklist for user

## Usage
/riper — start full 5-phase workflow for current task
/riper research — jump to research phase
/riper plan — jump to planning phase
/riper execute — jump to execution (requires plan to exist)
/riper review — run review on recent changes

## Rules
- Never skip phases for non-trivial work (>1 file changed)
- If in EXECUTE and you discover something not in the plan → STOP, flag it, update plan
- If build fails → back to EXECUTE, fix before marking REVIEW done
- Research agents (Explore) are used in RESEARCH phase automatically
