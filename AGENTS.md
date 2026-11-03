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

## RC.48: one-screen blocked-directory access diagnosis
- Append short `pathblock` workshop option in the existing select (no separate panel or mission) using the preexisting `recoveryFixture('intro')`: `~/practice/diagnostics/service.log` exists but its parent directory is mode 600 (missing x).
- Allow exactly bounded assignment, standalone `test -r`, real `echo $?` and read-only `namei -l` in this scenario. The expected execution is read test (exit 1) -> immediate echo showing 1 -> namei identifying the blocked directory. Require BASE references and real event targets, exit codes, `blockedAt`, and unchanged files, directories, permissions.
- Do not run `chmod`, repair permissions, shell code, host processes, network, or mutations. Reject unsafe commands at whole-script preflight. Keep four nonblank lines max, all older scenario IDs/draft keys intact and a distinct new draft.
- No new UI section, APK, changed mission/academy/progress schemas. Physical Android QA pending.


## RC.49: least-privilege directory permission repair
- Append the seventh short Bash option `repair` on the same mobile screen with the same four-nonblank-line limit and a unique draft key. Preserve all six old scenario IDs and storage keys.
- Start fresh with the existing virtual `recoveryFixture('intro')` (`diagnostics` starts 0600, service.log remains intact). Require `namei -l` evidence with blockedAt, minimal owner-x change (0600 -> 0700) and successful `cat` readback, in that order. Grade actual events, final state and unchanged unrelated modes, ownership, directories and file contents.
- Strict whole-script preflight allows safe assignment, read-only namei -l, one scoped chmod (u+x/700/0700), and read-only cat; reject chmod 777, unrelated writes, conditional operators, other targets and host commands *before* mutation.
- No exit-code prediction on Repair because there is no echo; do not affect other scenarios. No new screen, APK or achievement schema. Physical Android QA pending.

## RC.50: independent repair transfer, WITHOUT an eighth menu item
- Within existing Bash Workshop `07 · Naprawa`, provide one compact button toggling guided vs independent incident. No extra screen or permanent panel. Preserve `repair` ID, all seven menu options, all old draft keys and saved progress.
- Guided remains the RC.49 `diagnostics/service.log` fixture. Independent transfer uses already-defined `recoveryFixture('transfer')` as a fresh *local-only* virtual seed: `~/practice/logs/locked/health.log`, owner directory 0600, file 0644. Do not change Academy or global mission fixtures.
- Transfer has a blank initial editor and no ready-made commands in task or help. Separate draft key `ctf-master:bash-workshop-repair-transfer-draft-v1` and variant selection key `ctf-master:bash-workshop-repair-case-v1`. Switching cases or scenarios clears stale result, prediction, undo and caret while retaining each draft.
- Preserve the whole-script preflight allowlist with only scoped namei, minimal chmod and cat; reject broad permissions, wrong targets, extra commands and any host/network invocation BEFORE edits. Grade on real `namei` blockedAt, exact owner-x delta 0600→0700, successful cat readback and unchanged unrelated files, directories, ownership and modes. No mastery storage change.
- Keep four nonblank lines and existing same-screen mobile design; no APK. Physical Android QA still pending.

## RC.51: phone-first editor scroll without extra screens
- The Bash textarea grows and shrinks to content after edits, variant changes and viewport resize. It must not become a nested vertical scroller; gestures started over it should scroll the page.
- Toolbar retains horizontal swiping but allows vertical page gestures, and adds the `||` shortcut beside `&&`.
- Preserve all old scenario IDs and draft keys, undo, caret, selection, progress, interpreter and safety. No APK, extra screen, host execution or new dependencies. Physical Android keyboard QA remains PENDING.

## RC.52: two causes of read denial in the existing mobile diagnosis
- Within menu option `06 · Katalog`, add a compact guided/independent toggle; no eighth option, new screen or persistent panel.
- Existing guided diagnosis keeps `diagnostics/service.log` and its draft. Independent reuses Academy's `checks/locked.log` (mode 000, traversable parents), without modifying global fixtures.
- Independent draft is blank under `ctf-master:bash-workshop-pathblock-transfer-draft-v1`. Its selection uses a separate key. Switching clears result, prediction, caret and undo, but preserves each draft and the repair-case selection.
- Grade real test -r failure, immediately observed echo $?, and namei -l evidence on the correct file. Guided requires blockedAt = diagnostics; independent requires namei reach the mode-000 file without blocked directory. No spoofed output, host commands or file mutations.
- Predict status using the last actually executed echo even when subsequent namei follows. No fabricated verdict without echo. Preserve other achievements, seven menu choices, and simulated-only safety. Physical Android QA remains pending; no APK.

## RC.53: minimal owner-only file repair in existing mobile 07
- In existing Repair scenario, offer three variants via one compact native select: guided directory, independent directory and independent file. Do not add a menu item, pane, screen, long quest, APK or backend.
- Preserve all old keys; add only `ctf-master:bash-workshop-repair-file-draft-v1` with blank starter. Preserve existing selected repair-case key and migrate its old values intact.
- File incident reuses the Academy fixture `~/practice/checks/locked.log` (mode 000). No new fixture or global seed mutation. Require actual `namei -l` on the file (no blocked parent), minimally scoped `chmod u+r` or exact owner-only octal 400, then actual `cat` output matching the unchanged original bytes. Only the target file's mode may change from 000 to 400; reject all unrelated changes.
- Whole-script preflight blocks network, host execution, broad chmod 777, unrelated files and other filesystem changes before execution. Retain four-line editor, all prior repair and pathblock variants, draft/undo/selection safety, seven menu options and local-only simulated interpreter. Physical Android QA remains pending.

## RC.54: predict cause before executing Bash diagnosis
- In existing option 06 only, add an optional, compact cause prediction (directory missing x vs file missing r).
- Capture at Run and compare exclusively with actually executed failed test -r, immediate echo 1 and namei trace. Do not infer from selected variant. Missing evidence means undecidable.
- Predictions never affect completion; edits/case switches clear stale comparisons. Preserve existing drafts, undo, seven menu items, simulated-only execution, progress and four-line limit. No APK. Mobile physical QA pending.

## RC.55: blind two-cause path incident, same mobile screen
- Within existing scenario 06, replace old guided/independent toggle with a compact 3-way select: guided directory, independent file, blind incident. Preserve old IDs, both legacy draft keys, selection key and old restore values. Blank independent blind draft under `ctf-master:bash-workshop-pathblock-blind-draft-v1`.
- The blind incident always targets the same `~/practice/diagnostics/service.log` path, with one of two fresh *local-only* seeds: directory mode 0600/file 0644 or directory mode 0700/file 000. Do not alter global Academy fixtures or real disk. Cause stays stable across script edits and Runs; New incident reseeds, clears script and predictions.
- Require a cause hypothesis BEFORE Run for blind only. Actual executed test -r → immediate echo $? → namei -l must agree on the exact resolved target; compare hypothesis from genuine trace, never fixture labels or scripted output. Missing/foreign evidence is undecidable, not a win.
- Existing guided, independent and repair variants remain unchanged. No new menu item or screen, no >4 nonblank lines, no arbitrary shell, network, backend, APK, progress schema, or persistent mastery. Physical Android QA still pending.

## RC.56: three possible causes for the same mobile blind incident
- Keep the same seven Bash Workshop menu entries, existing blind draft key and four-line limit. No APK or new screen.
- Randomly choose one of three fresh virtual states for \`~/practice/diagnostics/service.log\`: no x on parent; no r on file; or an absent leaf with a traversable parent. Never mutate the shared Academy fixture.
- In the third case, \`namei -l\` correctly returns ENOENT and exit code 1. Treat this as valid diagnostic evidence only for the exact missing target; do not treat an unrelated failed command as success.
- Require a pre-run cause prediction for blind tasks; compare it against the actual failed \`test -r\`, immediate \`echo $?\`, and \`namei\` output, all on the same resolved path. The missing-file conclusion requires a missing leaf rather than a blocked ancestor.
- Preserve guided and transfer task behavior, legacy draft storage, safe preflight, and simulated-only execution. Physical Android keyboard and scrolling QA remains pending.

## RC.57: evidence to minimal response in existing mobile blind incident
- Keep the same seven Bash scenarios, path cases and four-line editor. Add one compact **post-run** response choice inside option 06 blind case only, with no new route or persistent pane.
- Player predicts cause before Run; after a completed diagnosis reviews the actual trace and chooses the least-privilege next action: restore owner x on blocked directory, restore owner r on unreadable file, or recover missing file from a verified backup. `chmod 777` is explicitly unsafe.
- Grade selected response from the **actual validated trace** (failed test -r, adjacent echo 1, namei for same target), not from the hidden seed, scenario label, submitted prediction, or string in incident feedback. Incomplete/foreign evidence is indeterminate.
- Feedback for blind completed diagnosis stays neutral until response is correct; after correct response reveal the original diagnosis summary. A wrong choice provides a non-spoiler correction prompt. No filesystem mutation on choosing an action.
- Run, edited scripts, scenario/variant switches and New incident clear previous response; selection changes invalidate submitted response. No new persistence keys, no change to mastery, simulated Linux only, no APK. Physical Android QA remains pending.

## RC.58: verify effects after choosing the minimal response
- The existing mobile 06 blind task gets one post-decision button, not a new page, editor, wizard, achievement key or APK. A correct plan alone is not marked as fully verified.
- The button executes a FIXED command via virtual `executeLinux` on a fresh cloned virtual state: owner-x on the directory, owner-r on the file, or cp from a known verified lab backup. Never execute a user's script in a host shell.
- The training backup in the missing-file case is staged only inside this disposable preview from the established recovery fixture. Explicitly state it is a lab assumption, not proof that a production backup exists. No Academy seed or saved incident mutations.
- Verify actual cat succeeds, effective target permissions are minimal, unrelated permissions/directories and contents/ownership are unchanged, and restored bytes match the verified training backup. Require all checks.
- Incorrect intervention, incomplete or foreign evidence must not launch a successful preview. Clear preview on edits, new Run, hypothesis change, remedy change, scenario switch and new incident. Mobile physical QA pending.

## RC.59: learners assess verification evidence before receiving the green checks
- Keep option 06 blind incident in the SAME result card, with no new mission, editor, wizard, router, persisted mastery/progress key, backend, or APK. Four original Bash script lines remain.
- After verified simulated recovery, do not immediately show the result checklist: show a compact multi-select with three independent types of valid proof (actual successful read, least-privilege scope, verified content/unchanged unrelated data) and a distractor (merely running chmod/cp).
- Compare selections using `RecoveryVerification.checks`, which were computed from actual virtual execution and state deltas, not scenario labels, hidden causes or expected answer strings. Incomplete/inconsistent/failing checks can never produce a positive verdict.
- Require exactly three distinct proofs; selecting command-only, missing a proof, or selecting duplicates does not pass. Avoid revealing answer details on an incorrect attempt; reveal the existing RC.58 checklist only after correct identification.
- `Zadanie wykonane` in blind mode now requires completed diagnosis, correct minimal intervention, successful preview and correct proof selection. Invalidate the proof answer upon edits, switching cases, a new run, changing a hypothesis/decision, or a new incident. Keep a11y checkbox labels and touch-size targets. No persistent new state. Android device QA remains pending.

## RC.60: interpret real before/after evidence, no repetitive checkbox memorization
- In existing mobile Bash Workshop option 06 (blind incident), replace the RC.59 four-checkbox generic quiz with one **case-specific** inference question based on concrete before/after observations: actual cat exit results, parent directory mode, target file mode/existence, and content match vs original/training backup.
- Derive case data from the incident state and the disposable verified recovery state, not the chosen cause, user hypothesis, or expected answer string. Only render a question if actual read transition, all three verification checks, minimal scope, original-data preservation and observed trace agree. Reject missing/forged/contradictory snapshots.
- Distinct real observations and three short interpretations for directory-x, file-r and missing-file recovery. Do not simply show three correct generic proofs. Always include a plausible distractor. Only show the existing all-green checklist after the user correctly interprets the specific observations.
- Preserve RC.57 decision and RC.58 isolated virtual repair. This remains **one mobile result card**, seven tasks and four Bash lines; no new persistence keys, backend, real shell, extra mobile page or APK. On edits/variant switches/new incident and response changes reset the graded conclusion. Device testing still pending.

## RC.61: three rotating unknown path tickets, nine combinations
- Retain one-screen mobile Bash Workshop option 06 and 7 total menu entries. New incident rotates the TICKET path/context to a different one of service.log, worker.log and billing.log (all under ~/practice/diagnostics) and independently draws one of the three hidden causes. User solves with four editor lines, not an extended wizard.
- Use `blindTickets.ts` as canonical data for ticket file, directory, content and unique training backup path. New tickets exist only in the fresh virtual incident world, never global Academy seed or production filesystem; the original guided service.log retains its historical behavior and draft key.
- Pass ticket ID through `runWorkshop`, `verifyRecoveryPreview` and `concreteRecoveryEvidence` so real same-target evidence, the correct incident file and isolated backup are checked end-to-end. Do not accept a good script, repair, or evidence from a different ticket.
- Incident description reveals filename and observed symptom only, never the hidden root cause. The new ticket is stable through edits, runs, and decisions; it resets only with changing into blind mode or tapping New incident. Keep prior local drafts/progress unchanged; do not persist ticket IDs as long-term mastery.
- Preserve execution safety and no host shell, no network, no APK. No route/screen, no 5th Bash line. Physical Android QA pending.

## RC.62: two legitimate diagnostic orders for independent blind incidents
- The same seven-item, four-line mobile Bash Workshop stays intact. In option 06 blind only, allow two read-only command paths after BASE: `test -r TARGET` → immediately `echo $?` → `namei -l TARGET`, OR `namei -l TARGET` → `test -r TARGET` → immediately `echo $?`.
- Validate the ACTUAL executed trace, strict same resolved target and BASE variable, failing read test, immediately following exit echo, and real namei evidence. Both paths must arrive at the same cause and work through the existing remediation, isolated repair simulation, and before/after evidence interpretation.
- A nonzero namei for an actually missing leaf is still expected evidence, whether it is run before or after the failed read test. Do not permit arbitrary command permutations, invented statuses, namei of another target or mutating shell commands; all commands remain allowlisted and preflighted.
- The guided directory and independent transfer cases intentionally retain their original fixed teaching order; do not change earlier drafts, keys, fixture seeds, achievements or the existing seven scenarios. No APK, network, host shell or extra screen. Android device QA remains pending.

## RC.63: short independent service/process diagnosis
- Add existing Bash Workshop menu option 08 (not a new page) for process/service triage. Three rotating tickets from existing virtual process fixtures: web (crash during runtime), api (failed startup), queue (healthy despite alert). A new ticket changes the service and clears the three-line draft and conclusion, never changes previous scenario drafts.
- Learner enters exactly three read-only independent virtual commands in any order: ps or ps aux; systemctl status SERVICE[.service]; journalctl -u SERVICE[.service]. Preflight the whole input BEFORE any execution. Reject kill, systemctl start/stop/restart, sudo, pipes, files, network or any other action. No host shell execution.
- Completion means evidence collection; the user then chooses the interpretation. Derive crash/startup/false alarm from executed status, journal and ps output for the same service plus the actual virtual process/service state, never an expected answer, scenario title or alert. Incorrect classifications must not reveal the answer; only a correct interpretation earns 'Zadanie wykonane'.
- Keep a single mobile result card, 3 lines, no new architecture screens/wizards, no changes to previous seven tasks, progress keys, service worker persistence or real process state. Add regression, tampering and safety tests; physical Android QA remains pending. No APK.

## RC.64: distinguish operational recovery from permanent root-cause removal
- After successful 08 service/process diagnosis, ask for the safest next response (restart only crashed web service; investigate failed api startup without pretending a restart is the fix; no service change for healthy queue with false alarm; 'kill' is a distractor). The learner must explicitly choose, and the response is judged from executed, cross-checked ps/status/journal evidence, not from the alert name alone.
- Only after the correct decision may the user preview actual effects in the isolated virtual Linux, with a fixed predetermined action. The transient web case runs 'systemctl restart web.service'; startup and false alarm cases run NO mutation and remain failed/active respectively. A successful web restart restores availability in the simulation, but does not prove permanent root cause removal.
- Re-read actual post-action 'systemctl status', 'ps', and 'journalctl' and verify target status, PID and journal integrity; ensure unrelated process/service state, filesystem and other subsystems stay unchanged. Never grant success for a wrong decision, forged trace, or non-Academy world.
- One short mobile result card; completion requires correct diagnosis + response + verified checks. Do not create a new task, wizard, host process call, network usage, saved achievements or APK. Clear actions and preview when draft, diagnosis, ticket or run change; keep earlier seven tasks and their storage keys. Physical Android QA pending.

## RC.65: distinguish real service start failure causes
- Existing mobile Bash Workshop option 08 adds three *virtual only* ticket fixtures reporter (configuration validation failed), scheduler (redis.service dependency unavailable), gateway (HTTP port 8080 Address already in use). Keep legacy web/crash, api/generic startup and queue/healthy behaviors and read-only diagnostics unchanged.
- Six small incident families rotate with "Nowe zgłoszenie"; still exactly three `ps`, `systemctl status UNIT`, `journalctl -u UNIT` commands in any order. Build a fresh ticket-specific in-memory state by appending one failed process and service to a clone of Academy fixtures. Never mutate the Academy seed, persist new fixture state, or execute host processes/network.
- Evaluate cause from actual journal, status and ps evidence: generic failure vs config typo vs missing dependency vs occupied port. Six explicit diagnoses, with distinct safe decisions for the three new failures: inspect configuration, check service dependency, identify port owner. Do not award "restart fixed it" to any persistent startup root cause. Decisions are advisory; no fixed mutation preview for the three new failures. Leave them failed while verifying status/PID/journal and unchanged other resources.
- Validate all 6 tickets × 6 read-only command orders plus wrong target, forged evidence, incorrect remedy, non-mutating previews and legacy regression. Preserve existing storage keys, four-line max in earlier exercises, no new route or APK. Physical Android QA still pending.

## RC.66: validate cross-service dependencies and actual listening ports
- Keep mobile Bash Workshop option 08 and six rotating tickets unchanged. Old web, api, queue, reporter use three independent commands as before. Scheduler and gateway now require exactly FOUR short read-only commands (any order): ps, systemctl status target, journalctl -u target, plus one case-specific corroboration.
- Scheduler: inspect the second virtual service via `systemctl status redis[.service]`. The ticket's isolated world contains a truly failed Redis dependency with a stopped process; do not mutate Academy baseline.
- Gateway: use `ss -ltnp` to discover the separate running `legacy-proxy` PID 615 listening on port 8080. The command's owner/port data must be generated from the *actual virtual processes*, not inserted as a forged text explanation. The original `ss -lnt` network lab remains unchanged.
- Full-script preflight before executing any command; strict command strings, one of each required category, correct target, successful exit and output provenance, and cross-check against actual state. No pipelines, host shell, network requests, restarts or kills. Four-line mobile cap, no new page or achievement.
- Classifications and safe response decisions still use RC.65 service triage. Missing, wrong, copied, or tampered extra evidence must fail. New tickets keep current state unchanged after an advisory response. Test the four-step permutations and old tickets, and leave physical phone QA pending. No APK.

## RC.67: inspect and minimally correct the reporter configuration
- Keep existing mobile `08 · Usługi` with six rotating tickets, no new page, browser shell, backend, save keys or APK. Only reporter now requires four read-only diagnostic commands (in any order): `ps[ aux]`, `systemctl status reporter[.service]`, `journalctl -u reporter[.service]`, `cat /home/player/practice/reporterd.conf`. Other 3-line and 4-line tickets remain unchanged.
- The reporter's lab config is a real virtual file stored only in its fresh incident world; it contains an invalid `output_dir=/var/reports` key and a comment listing supported keys including `output_path`. Actual cat output and journal error must agree; a missing, forged, different-target or edited file must not earn a diagnosis.
- After correct reporter diagnosis, replace the generic action dropdown with one compact *specific config correction* selection. Only renaming `output_dir` to `output_path` while retaining its value passes. Reject deletion, chmod 777, or restart without fixing the config; don't reveal the solution on incorrect feedback.
- The fixed preview edits ONE line in an isolated virtual snapshot; verify the actual cat of the changed config, preserved values, unchanged modes/owners/other files/services/processes. The reporter service deliberately stays **failed**; this is a verified configuration correction, not a claim of availability or a successful restart.
- The player completes reporter only after a verified minimal correction. Clear both pending correction and preview on edits, running code, changed diagnosis/ticket and new incident. Earlier service decisions, workshop progress, network, and Academy fixture remain intact. Device QA pending.
