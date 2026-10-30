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
Next PR: prioritize manual Android/PWA QA from docs/MOBILE_QA.md before broadening the curriculum. Remain Linux-first: 24 technical lessons plus one multi-step investigation = 25 intro/transfer pairs, 16 missions and 20 review variants. The simulator now enforces a limited owner/group/other rwx model, checks directory search x, and allows chmod on owned directories. It is NOT full POSIX ACL/umask/sudo/chown; do not claim that. Keep all old progress keys and support legacy states with missing identity or ownership. Never execute learner commands in the host shell. Avoid feature bloat.
