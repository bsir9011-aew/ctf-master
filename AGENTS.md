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

## Android build notes (RC.33)
- An Android debug APK is built with Capacitor 8 from the Vite `dist` output; the generated `android/` is intentionally not checked in.
- The JavaScript terminal remains simulated in the Android WebView. Never enable Android shell execution or remote eval.
- The GitHub workflow uploads an APK built on JDK 21 and Android API 36. Runner debug signing is not a stable release key, so do not promise upgrade continuity.
- Native WebView localStorage is isolated from PWA browser localStorage. Do not imply progress migrates on installation. Keep existing web localStorage keys unchanged.
- Physical phone QA and offline verification require a real device, not just green build.

## Near-term priority
Next priority: have the user run physical PWA QA per docs/MOBILE_QA.md and perform the REAL-01 lab in their own Codespace. Do not claim that Node tests establish phone QA or learner proficiency. RC.32 adds a separately isolated, real Linux permission lab under labs/real-linux, not connected to the PWA simulator. The setup is idempotent, does not reset data and must require no sudo or host service changes. Keep Linux-first: 33 technical lessons plus one investigation = 34 intro/transfer pairs, 22 missions and 20 reviews. `chgrp` supports only changes by an owner to a group in their own virtual memberships. Keep owner UID, mode and content unchanged, and require post-change inspection for mastery. No `sudo`, `chown`, recursive operations or host execution. RC.20 adds strictly simulated stdout > and >> for read-only commands; refuse host execution, write failures and self-overwrite. RC.21 uses one lexer for quoted and escaped words, pipes and redirects; single/double quotes and escaped whitespace are educational subsets, never a full Bash. RC.30 adds an evidence-grounded after-action report captured ONLY at the first mission completion. Preserve it by mission ID across switching sessions, and show a clear historical-unavailable state for older completions; no fabricated backfill. A reflection is optional and never a graded task. Maintain all existing storage keys. RC.29 appends mission 21: a blind Linux permission incident. Suppress all mission-specific hints and automatic coach feedback for that mission. Seed once, preserve old user files, and validate evidence of failure, diagnosis, minimal fix, and readback. RC.28 appends mission 20 with deliberately disabled queue; wrong service interventions degrade simulated availability, but can be repaired. Preserve side-effect observations in mission events and seed only when selected/restored. Never contact real endpoints. RC.27 appends mission 19 with a simulated HTTP health endpoint, a virtual live/safe pool config and systemctl restart applying the on-disk config. Preserve prior data; only seed on selecting or restoring this mission. No real network access. RC.26 appends mission 18 with decoy logs, explicit assessed hypotheses, evidence preservation and late report; seed its files only upon selecting it or restoring it active, never reset existing saves. RC.25 adds mission 17, a capstone over the preexisting simulated app/auth logs with ordered evidence provenance, guarded copies and a two-source report. This appends the mission without altering old save keys or the first 16 indices. RC.24 adds a bounded && / || virtual conditional chain, with left-to-right short-circuit and transparent executed/skipped trace. Never run skipped commands. RC.23 supports only unary virtual test/-e/-f/-d/-r/-w/-x, bracket alias and path traverse checks; a false condition is status 1 and is expected in the new exercise. RC.22 stores optional lastExitCode (legacy default 0), exposing previous result via echo $? and setting the new status after each outer command. Do not change child stage status in a pipeline. Preserve all previous localStorage keys, previous completions, legacy ownership/identity/umask defaults, and the safe simulated filesystem.

## RC.36 Virtual Bash variables
- Variable assignments and expansions are virtual and never run shell/host commands. Preserve proper single/double quote and escaped-dollar semantics; do not split variable expansions into executable syntax.
- User variables persist only in the virtual LinuxState. Keep name/value bounds, reserved HOME/PWD, and idempotent legacy migration (missing `variables` means empty).
- Academy 34 and independent transfer require traced variable references, real state effects and final evidence readback, not exact user command strings.
- No full shell scripting, command substitution, eval, arbitrary environment access or globs. Preserve existing pipelines, redirects, conditions and exit code behavior.

## RC.35 Progress portability
- `src/core/progressBackup.ts` stores only achievements, review summaries, Academy scores, AAR and reflections, not full simulated filesystem/events. Format `ctf-master-progress` schema 1. Import merges progress non-destructively and validates recognized IDs.
- The backup UI remains collapsed and near the bottom of the app to keep mobile lessons short. Clipboard API is optional, manual select/copy fallback is required for Android WebView.
- Do not send backups over the network, inject them as code, or silently reset saved progress. JSON backups may include learner notes; advise private storage outside APK.
- Imported progress must remount Academy state so its old useEffect cannot overwrite restored achievements. No new server/connector/login.
- Existing debug APK signing continuity is still not guaranteed. Physical copy/paste testing remains pending.
