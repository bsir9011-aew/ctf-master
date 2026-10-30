# Instructions for coding agents - CTF Master

## Product goal
Mobile-first PWA teaching Linux and CTF through interactive, causal labs. Progression: explanation -> user attempt -> feedback -> variation -> transfer without hints.

## Constraints
- React + TypeScript + Vite; prefer small, maintainable changes.
- All command execution in `src/core/linux.ts` is a simulated interpreter. NEVER execute user input in a shell, browser eval or backend process.
- Check mission success based on resulting state/actions, not exact answer strings.
- Preserve local session progress when evolving data structures; introduce versioned migration when needed.
- Never expose the flag in UI hints or README; flags are discoverable via terminal actions in the intended lab. In-browser static flags are *not* secret and do not constitute secure server-side challenge validation.
- Keep UI usable on touchscreens, mobile portrait, keyboards and screen readers.
- Introduce external infrastructure only for isolated, intentionally provisioned labs in future iterations.
- Do not bloat validation. Before a PR: `npm run build` and manual smoke test for the changed mission. Add focused automated tests when engine becomes more complex.

## Near-term priority
Next PR: use findings from the external independent pedagogical research and conduct physical-device QA before expanding features. The Academy has 21 command/technique lessons plus one multi-step log investigation, each with a changed-data transfer (22/22). Preserve source-evidence validation, required read-before-copy order, and clean mastery grading; never reveal unseen transfer source files in hints. Keep 16 CTF missions and 20 reviews unchanged, old localStorage keys, and no real shell execution. Test Android PWA offline using docs/MOBILE_QA.md.
