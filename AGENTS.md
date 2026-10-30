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
Next PR: prioritize physical Android/PWA QA per docs/MOBILE_QA.md. Keep CTF Master focused on the Linux simulator and practical command proficiency, not broad Web/Pwn/Crypto product expansion. The Academy has 22 technique lessons plus one investigation (23 introductions and 23 transfer tests). man is a local, limited reference for implemented commands, not a full system man utility. Preserve the manual-before-action exercise, clean mastery grading, existing localStorage keys, 16 missions and 20 reviews. Never execute learner input in host shell.
