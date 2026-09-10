# Project Workflow & Development Process

This document records *how* the project was built — an AI-assisted, test-driven workflow. It
doubles as the process record for the interview.

## Approach

- **AI-assisted development** — an AI coding assistant was used throughout; every output was read,
  verified, and owned rather than pasted blindly.
- **Test-Driven Development (TDD)** — the acceptance criteria were turned into an executable test
  suite *before* the implementation, so the code was driven by the contract.
- **Context-efficient prompting** — the spec was fed to the assistant once and then referenced by
  name; the codebase was kept small and single-purpose so the assistant always had full context;
  each prompt targeted one artifact to minimize wasteful regeneration.

## Phases

1. **Understand the spec** — load the full problem statement; extract functional and
   non-functional requirements.
2. **Tech-stack decision** — vanilla HTML/CSS/JS in a 3-file split (logic / UI / tests), chosen
   for simplicity, explainability, and easy live modification.
3. **Design** — high-level (4-layer architecture) and low-level (the `runEvaluation` pipeline and
   the `evaluateRole` rule logic). Diagrams live in `docs/`.
4. **Test suite first** — encode every acceptance criterion and edge case as assertions.
5. **Implementation** — build the pure logic function by function until the tests pass, then the
   UI on top.
6. **Refine, verify, document** — run all tests and acceptance criteria end-to-end, then finalize
   the docs.

## Key Design Decisions

- **Roles are data-driven, not hardcoded.** The five roles live in a `ROLES` config array, and a
  single generic `evaluateRole(profile, role)` applies the same checks to any role. Adding or
  removing a role is a *data* change, not a code change (configuration over code). This also makes
  the most likely live-modification request — "add a new role" — trivial.
- **Failure-reason order is implicit in code, not a declarative rule list.** The five checks run in
  the required order inside `evaluateRole`, each appending to a `reasons[]` array. With only five
  fixed rules — one of which (`MISSING_SKILL`) emits multiple reasons — a declarative rule list
  would have been abstraction for its own sake, which the brief warns against.
- **Rules are evaluated independently (no short-circuit).** An ineligible role must list *every*
  failed rule, so evaluation collects all failures rather than stopping at the first.
- **Field validation does short-circuit.** An invalid profile field reports a single `INVALID_*`
  code and clears prior results/counts — a malformed profile can't be meaningfully evaluated.
- **Numeric validation is stricter than the literal spec (documented assumption).** Only plain
  decimal input is accepted; hex/scientific forms such as `0x7EB` or `2e3` are rejected even though
  JavaScript's `Number()` would treat them as valid, because a human filling the form never types
  them. Caught during review — a test was added first, then a regex guard.

## Constraints Given to the AI

- Simple and explainable over clever — no framework, no build step, no speculative features.
- Pure logic must be separated from the DOM, to enable testing and low-risk live edits.
- Honest, realistic scope — implement exactly what the spec requires, nothing more.
