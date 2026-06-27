# Offline And Surrogate Validation

Use this reference when target hardware is unavailable. The goal is not to pretend hardware verification happened; the goal is to obtain the strongest proof reachable from source code, host tools, and captured artifacts.

## Validation Ladder

Prefer higher levels when available:

1. Cross-compile or project build allowed by local rules.
2. Syntax-only or object-only compile for touched files.
3. Host-side unit test, replay test, parser test, or state-machine test.
4. Static analysis or compiler diagnostics.
5. Deterministic source review with call-chain and invariant checks.
6. External device validation package for tester or onsite engineer.

If none of the executable levels are possible, mark verification as `C: analysis-only`.

## Common Surrogate Methods

### Log-Based Faults

- Search for exact log strings and nearby return paths.
- Confirm every logged failure path releases acquired resources.
- Add or preserve diagnostic logs only when they are consistent with local logging style and will not flood hot paths.

### Crash Or Null Pointer

- Trace object ownership from allocation/creation to all teardown paths.
- Check async callbacks, timers, worker threads, and delayed messages that may run after destruction.
- Prefer cancelling callbacks and clearing ownership state over adding a late null check at the crash line.

### Memory/Buffer Defects

- Verify buffer length units: bytes, samples, frames, pixels, channels, stride, and alignment.
- Check producer/consumer queue depth and backpressure.
- Confirm ownership transfer rules for DMA/media/audio/video buffers.
- Review error paths for leaks and double-free risks.

### Threading And State Machine Defects

- Identify the thread that owns each state transition.
- Check lock order, mutex coverage, condition waits, timeout paths, and callbacks re-entering state handlers.
- Replay state transitions manually from logs or code when no executable test exists.

### Driver/Device Interaction

- Validate open/close/ioctl/read/write ordering.
- Confirm retries have bounded limits and clear recovery behavior.
- Check unplug, timeout, EIO/EBUSY/EINTR/ENOMEM, and partial-transfer paths.
- Do not replace device sequencing requirements with arbitrary sleeps unless hardware documentation or existing code requires it.

### LVGL/UI Controller Defects

- Confirm LVGL object lifetime, event callback ownership, timer cancellation, and screen transition ordering.
- Check whether callbacks can fire after a screen/widget is destroyed.
- Validate UI updates run in the expected LVGL/UI thread context.

### Multimedia And A/V Pipeline Defects

- Trace frame/buffer ownership across capture, decode, render, encode, and release.
- Check timestamp, stride, format, channel count, sample rate, and queue depth assumptions.
- Verify stop/restart and error recovery paths drain or release buffers deterministically.

## Device Validation Package

When hardware validation is external, provide a compact package:

- firmware/app version or commit hash
- exact operation steps
- expected pass/fail observations
- logs to capture and log keywords to search
- stress duration or iteration count
- rollback condition
- known residual risks

## Evidence Wording

Use precise wording:

- "Static review passed for touched lifecycle paths."
- "Host-side replay passed using captured sample."
- "Build was not run because local project rules forbid automatic build."
- "Device validation is pending; hardware behavior is not proven in this environment."

Avoid:

- "Verified fixed" when only static analysis ran.
- "Resolved" when target hardware was unavailable.
- "Should work" without naming the invariant that was restored.
