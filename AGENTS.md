# Agent Instructions — ClearPath Review

Adapted from `devvit-unity-project/Docs/Agents/AGENTS.md`. Game-specific architecture and legacy deployment instructions intentionally omitted.

## Minimum effective change

- Read relevant files before editing. Trace the cause, not only the symptom.
- Choose the smallest change that correctly solves the problem; match established patterns.
- Do not refactor unrelated code, add speculative abstractions, or leave TODO comments.
- Derive counts and statuses from the underlying records rather than maintaining duplicate state.
- Existing authorization covers this initial product build and necessary iteration. Ask only when a change materially exceeds the agreed product scope.

## Product and implementation

- Optimize for a compliance reviewer reaching a clear, defensible decision with fewer follow-ups.
- Every visible control must work. Prefer one complete review/revision/approval loop to broad unfinished features.
- Approval belongs to an exact creative version and stated use. A marketer response never resolves a reviewer finding by itself.
- Automated checks are illustrative assistance, never a legal determination. Clearly identify demo data and local persistence.
- Use semantic controls, keyboard access, visible focus, readable contrast, responsive layouts, and reduced-motion support.
- Preserve submitted versions and decision history. Do not silently carry approval into a revised creative.
- No credentials, real consumer data, or private source material in the repository or deployed bundle.

## Evidence and delivery

- Commit meaningful milestones, including the first functional unpolished version. Capture genuine stage GIFs; never reconstruct development history and present it as original.
- Keep the README concise, first-person where useful, and accurate about implemented behavior, assumptions, tests, limitations, and time spent.
- Test workflow invariants and exercise the actual browser experience. A successful build is not a verified deployment.
- Use adversarial agents for focused product, implementation, documentation, and deployment reviews. Resolve material findings before delivery.
- Publish only to the isolated `promptarmor` project/path. Preserve existing GitHub Pages content and configuration.
