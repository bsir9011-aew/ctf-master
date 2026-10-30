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
Next PR: prioritize real-device Android PWA QA from docs/MOBILE_QA.md. Remain Linux-first. Academy has 23 technical lessons plus one investigation: 24 intros/transfers, 16 missions, 20 reviews. The simulated identity model covers whoami/id/groups and does not yet enforce group-based filesystem permissions: avoid suggesting it grants access, root privileges or sudo. Preserve legacy session data lacking identity, existing localStorage keys and all prior completions. Never execute user commands on the host. Scope future work narrowly to group permissions and directory traversal AFTER manual QA.
