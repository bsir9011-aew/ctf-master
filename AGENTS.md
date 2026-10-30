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
Next PR: prioritize a physical mobile/PWA QA pass per docs/MOBILE_QA.md before broadening the curriculum. Keep Linux-first: 28 technical lessons plus one investigation = 29 intro/transfer pairs, 16 missions and 20 reviews. `chgrp` supports only changes by an owner to a group in their own virtual memberships. Keep owner UID, mode and content unchanged, and require post-change inspection for mastery. No `sudo`, `chown`, recursive operations or host execution. RC.20 adds strictly simulated stdout > and >> for read-only commands; refuse host execution, write failures and self-overwrite. Preserve all previous localStorage keys, previous completions, legacy ownership/identity/umask defaults, and the safe simulated filesystem.
