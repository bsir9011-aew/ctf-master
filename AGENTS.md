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


## RC.37 - virtual for loops
- Grammar: for NAME in 1-5 values; do one command; done (single line). No nested loops, globbing, eval, script files or host shell.
- Validate entire loop structure before executing any iteration. Expand list values at loop entry, and body variables per iteration. Bound input and values.
- Persist variable as last loop value; retain last iteration's exit code. Keep trace for each actual execution, including variable refs, target and status.
- Intro lesson 35 and independent transfer validate exact file evidence from actual loop steps and subsequent readback. Preserve previous achievements, IDs, imports and existing app keys.
- Continue in the GitHub repository without distributing APK.

## RC.38 One-screen Mobile Bash Workshop
- First design for phone: one short task, up to four code lines, one Run button and inline result. No multi-screen wizard, tall stacked consoles or mandatory progression.
- Details/trace/help stay collapsed. Hide the welcome banner and REAL-01 bridge in Bash mode; keep four nav tabs in one phone row.
- Preflight complete script before changes. Allow only assignments, a bounded for loop with cp body, and test -f predicates. All steps use the virtual Linux interpreter with fresh state per run. No host shell, network, eval, script files or real filesystem access.
- Validate actual copied contents, loop references and predicate trace. Report first relevant mismatch.
- Save only the draft in a separate localStorage key; do not alter Academy/mission/progress-backup schema or claim persistent mastery.
- Repo-only work. No APK distribution.

## RC.39 Bash editor thumb controls
- Keep the existing one-screen workshop and the same challenge; avoid multi-step missions and extra permanent panels.
- A single compact row of Bash symbol shortcuts inserts text at a stored textarea selection/caret (including replacing a selection), returns focus with preventScroll and restores the caret after React commits.
- Use pure `insertAtSelection` and respect the existing 700-character max. Unsupported/overflow input must not mutate the draft or grant any progress.
- Shortcuts: `$`, double quote, single quote, tilde, `&&`, semicolon, and newline. Keep original localStorage draft key and engine untouched. Let vertical page scroll remain available on mobile.
- CI tests the pure editing function; actual Android keyboard behavior still needs physical QA. Repo-only: no APK distribution.

## RC.40 Error-to-line navigation on mobile
- Feedback for Bash Workshop may expose optional `errorLine`, a one-based *physical textarea* line number. Blank lines and CRLF must retain their original positions, even though evaluation ignores blank lines.
- Preflight and runtime failures map to exact source lines; semantic failures navigate only when there is a supported source line (do not invent a target when a command is missing entirely).
- One `Popraw linię N` action inside the existing compact result focuses the editor, selects the actual command text, and scrolls it into view. No separate editor, extra panel or multi-stage tutorial.
- `src/core/workshopSourceLines.ts` is pure and tests logical source mappings / selections with LF, CRLF and UTF-16 offsets. Preserve old draft and achievements.
- CI tests do not constitute physical Android keyboard QA. Repo-only: no APK distribution.

## RC.41 Mobile editor undo and opt-in native CI
- Keep one compact Bash screen. Add one Undo key to the existing shortcut row, with accessible label and disabled state. Do not add new panels or missions.
- Record bounded (20) undo snapshots for typing, shortcut insertions and template reset. Group only adjacent fast typing at the same caret; never merge independent shortcut, paste or reset edits.
- Undo restores both draft content and UTF-16 textarea selection; update the same local draft key, invalidate stale result feedback, and never change Academy or mission progress.
- History stays in memory only. No serialization, backend, new JS execution or host commands.
- Android APK workflow is manual-only while development remains repo/web-first. Validate npm test/build automatically; physical phone keyboard QA remains outstanding.

## RC.42: second short Bash diagnostic on the same mobile screen
- Keep exactly one shared editor and result panel; the new compact native select switches between backup and diagnosis. No wizard, additional tabs or multi-stage work.
- `src/core/workshopScenarios.ts` is the single source of scenario IDs, draft keys and starter scripts. Preserve the RC.38-41 legacy draft key for backup and use a separate key for diagnosis. Switching scenarios must clear obsolete results, prediction, undo/caret state but must not delete either saved draft.
- Diagnosis verifies an existing and a missing log with real `test -f` results chained by `&&`, followed by `echo $?`. Expected exit status 1 is evidence, not an app failure. Do not allow unrelated commands, copying, modification, host shell or network.
- Each evaluation starts with fresh virtual `createAcademyState`. Never claim a task passes on string matching alone; require conditional traces, target paths, actual exit codes and observed echo status.
- Keep old `runWorkshop(script)` default behavior; do not change Academy, missions, review or backup schemas. Repo-only: no APK distribution.

## RC.43: File permissions diagnosis in one compact Bash task
- Third scenario `permissions`: a real virtual fixture `~/practice/checks/locked.log` exists with permissions 000. Learner must observe `test -f` => 0, `test -r` => 1 chained by `&&`, then `echo $?` => 1. Permission denial is not missing file.
- Only assignments, safe `test -f` / `test -r` and direct echo-status are allowed; reject chmod, copying, host shell, network or any file mutation before running. Never award mastery merely because the script prints '1'. Verify actual predicate traces, file target, order, statuses, and unchanged world.
- Keep the same small mobile editor, dropdown, help, feedback, undo, and source-line navigation. Do not introduce another screen or a multi-step quest. Preserve all existing scenario IDs and draft keys; add a separate `permissions` key.
- No persistent mastery schema changes or new Android build. Physical mobile QA is still pending.

## RC.44: Bash fallback on one mobile screen
- Fourth scenario `fallback`: missing.log is absent (test -f => 1), then `||` actually executes existing manual.log (test -f => 0). A direct subsequent `echo $?` must observe 0.
- Validate trace order, operator, real statuses and no filesystem mutation; reject forged output or skipped fallback. Preserve all RC.38-43 scenario keys and use new isolated fallback draft.
- No extra screen, more than four code lines, host execution or automatic Android APK. Manual phone QA still pending.

## RC.45: conditional trace visibility
- Show the actual executed/skipped predicates from real conditionalTrace in the existing collapsed Bash trace. Explain short-circuit decisions for && / ||; never claim a skipped test ran.
- Leave workshop scenarios, drafts, validation, achievements, host safety and screen layout unchanged. Mobile physical QA remains pending.

## RC.46: pre-run exit-status prediction
- Keep the same compact select beside Run in Bash Workshop: backup predicts copies (legacy behavior); diagnostic scenarios optionally predict exit status 0/1 before execution.
- Capture prediction only on Run, never grade a choice made after inspecting the result. Script edits and scenario switches invalidate stale prediction feedback.
- Compare against actually executed final `echo $?` output, not the scenario's expected status or script text. If no echo executed, show no fabricated verdict. Prediction is formative and never changes challenge completion, persistent scores or progress.
- Preserve old scenario IDs/draft keys and safety. Do not create a new screen, mission, full Bash interpreter, or automatic APK. Device QA remains pending.

## RC.47: independent Bash transfer, no new screen
- Append fifth short workshop option `transfer`; four existing scenario IDs, starters and draft keys remain unchanged.
- New task is different evidence: missing `~/practice/audit-daily.log`, existing `~/practice/alerts.log`; learner must infer and execute fallback (`||`), inspect real status via `echo $?`, and use BASE from earlier learning. Blank starter, no ready-made script or syntax hints in task/help.
- The strict evaluator checks the *actual* two predicates, target paths, executed order, operator, statuses, immediate echo and no file changes. Reject old scenario's solution, skipped branch, forged echo, unsafe commands before execution. Start from fresh virtual academy state per attempt.
- Do not create another screen, panel, wizard or progress schema. Transfer draft is separately stored under `ctf-master:bash-workshop-transfer-draft-v1`. Keep up to four nonblank script lines and avoid APK production. Physical phone QA pending.
