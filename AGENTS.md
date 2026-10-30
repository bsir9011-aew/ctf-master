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
Next PR: prioritize physical Android/PWA QA from docs/MOBILE_QA.md. Remain Linux-first: 25 technical lessons plus one investigation, 26 intro/transfer pairs, 16 missions and 20 reviews. namei -l is an offline, read-only path diagnostic, stopping at the first directory that lacks search x. Preserve least-privilege directory repairs and correctly scoped success scoring, existing localStorage keys and legacy identity/ownership fallbacks. The simulator is not full POSIX and cannot run user input on the host. Avoid unrelated feature expansion.
