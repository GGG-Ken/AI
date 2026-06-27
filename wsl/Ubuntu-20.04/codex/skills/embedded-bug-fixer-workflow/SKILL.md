---
name: "embedded-bug-fixer-workflow"
description: "Embedded bug fixing workflow for C/C++, embedded Linux, RTOS, drivers, multimedia, UI controllers, protocol stacks, and hardware-adjacent defects. Use when fixing embedded bugs where hardware may be unavailable; enforces evidence-first root cause analysis, resource/thread/lifecycle review, and surrogate validation instead of unverified fix claims."
triggers:
  - pattern: "修复嵌入式.*bug"
    description: "Start an embedded bug fix workflow"
  - pattern: "embedded.*bug"
    description: "Fix an embedded software bug"
  - pattern: "无硬件.*验证"
    description: "Fix or validate without target hardware"
---

# Embedded Bug Fixer Workflow

This skill guides Codex through embedded bug fixing when the target device may be unavailable. It is optimized for embedded Linux, RTOS tasks, drivers, LVGL/UI control, multimedia pipelines, IPC/protocol code, and resource-constrained C/C++ systems.

## Operating Rules

- Start from observable evidence: logs, call chains, timing, resource state, crash dumps, traces, register/state snapshots, or reproducible operation steps.
- If target hardware is unavailable, state the verification boundary before changing status or claiming a fix.
- Do not claim "hardware verified", "fixed on device", or "resolved" without direct device/runtime proof.
- Prefer root-cause fixes over delays, retries, sleeps, null guards, or state resets that only hide symptoms.
- Keep diffs focused. Avoid broad refactors unless they are required to remove the fault path.
- For C/C++ changes, add concise Chinese comments for non-obvious lifecycle, ownership, asynchronous behavior, thread synchronization, timers, callbacks, queues, and important state transitions.
- Do not modify generated files such as `*_gen.c`, `*_gen.h`, or build-generated outputs unless the user explicitly requests regeneration workflow changes.

## Phase 0: Capability And Boundary Check

Classify what can actually be verified:

- `A: direct-device`: target board, emulator with equivalent peripherals, serial shell, remote lab, or runtime service is reachable.
- `B: assisted-evidence`: no direct control, but logs, dumps, traces, videos, screenshots, or tester feedback exist.
- `C: offline-surrogate`: only source code and static artifacts exist; validation must use host-side checks and reasoning.

Report:

- reachable environment and evidence
- missing hardware/peripheral/sensor/network/audio/video path
- final verification owner if device validation is external
- build restrictions, read-only output paths, or unavailable toolchains

## Phase 1: Failure Model

Build a concrete failure model before editing:

1. Identify the symptom, trigger, affected version, and expected behavior.
2. Locate the code path with `rg`, symbol search, call-chain tracing, logs, and config/build references.
3. Map the runtime sequence: task/thread, callback, ISR/deferred work, timer, queue, event loop, buffer ownership, and teardown path.
4. Record resource constraints: heap/stack, file descriptors, DMA/media buffers, audio/video frame queues, mutexes, semaphores, device nodes, handles, and persistent state.
5. Define the most likely root cause and at least one alternative cause to disprove.

If the original failure cannot be reproduced, explicitly mark the fix as analysis-driven and continue only with documented risk.

## Phase 2: Fix Design

Before editing, define:

- root cause in one or two concrete statements
- exact files/functions to change
- ownership or lifecycle changes
- thread-safety or ordering constraints
- rollback/recovery behavior for error paths
- regression surface and validation plan

Use the repository's existing style and helper APIs. Do not introduce a new abstraction unless it removes real risk or matches an established local pattern.

## Phase 3: Implementation

Apply the smallest correct change:

- Fix the first failing invariant, not just the last crash point.
- Keep cleanup symmetric with initialization.
- Make callback/timer/worker teardown deterministic.
- Protect shared state with the same lock/thread model already used nearby.
- Check return values on allocation, open/ioctl/read/write/start/stop operations when failure can affect runtime stability.
- Preserve existing comments and add Chinese comments only where they clarify complex embedded behavior.

When a workaround is unavoidable, document why a direct fix is not possible and what device evidence is still required.

## Phase 4: Reachable Validation

Use the strongest available validation level:

- `A: direct-pass`: device/emulator/runtime path executed and passed.
- `B: surrogate-pass`: host-side or static validation passed, device validation pending.
- `C: analysis-only`: code review and reasoning only; no executable proof.

For no-hardware work, load `references/offline_validation.md` and choose suitable surrogate checks such as:

- compile or syntax-only build if allowed by the project
- unit tests or host-side replay
- parser/state-machine replay using captured samples
- static analysis, `rg`-based invariant checks, or targeted code review
- lifecycle/concurrency checklist review

Never run a project build that local project rules forbid. If a build output is read-only, report the mount state and stop instead of trying chmod/chown or repeated builds.

## Phase 5: Closeout

Final report must include:

- files changed
- root cause
- fix summary
- verification level `A/B/C`
- exact commands or checks run and their result
- remaining hardware validation gap
- external verification steps for tester/device owner when hardware is unavailable

Use evidence-matched wording:

- `A`: "directly verified on reachable runtime"
- `B`: "host/surrogate validation passed; device verification pending"
- `C`: "analysis-only fix; requires device/build validation"

## Optional References

- `references/offline_validation.md`: validation strategies when no hardware is available.
- `references/embedded_review_checklist.md`: focused checklist for resource, concurrency, lifecycle, and recoverability review.
