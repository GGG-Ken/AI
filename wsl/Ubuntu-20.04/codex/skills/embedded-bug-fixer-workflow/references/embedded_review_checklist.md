# Embedded Bug Review Checklist

Use this checklist before finalizing an embedded bug fix, especially when hardware is unavailable.

## Resource Ownership

- Allocation and free paths are symmetric.
- Ownership transfer is explicit for buffers, handles, file descriptors, LVGL objects, timers, callbacks, and media frames.
- All early returns release resources acquired earlier in the function.
- Start failure unwinds partially initialized state.
- Stop/deinit paths tolerate repeated calls only if the surrounding code can actually call them repeatedly.

## Concurrency And Async Safety

- Shared state is protected by the established lock or single-thread ownership model.
- Callback, timer, worker, ISR-deferred, and event-loop paths cannot use freed objects.
- Teardown cancels pending async work before releasing owned memory.
- Lock order does not introduce deadlocks.
- Blocking operations are not added to real-time, UI, ISR, or hot media paths.

## State Machine And Time Sequence

- Each state transition has a valid predecessor.
- Error transitions leave the module recoverable.
- Restart after failure does not reuse stale handles, buffers, or flags.
- Timeout handling is bounded and observable.
- Event ordering is robust against duplicate, missing, or delayed events.

## Memory And Data Integrity

- Length calculations use the correct unit.
- Array indexes and ring-buffer wraparound are bounded.
- String operations preserve termination and capacity.
- Struct lifetime and pointer aliasing are clear.
- Format conversion handles stride, alignment, endian, sample format, channel count, and pixel layout.

## Driver And System Calls

- Return values are checked where failures affect stability.
- `EINTR`, `EAGAIN`, `EBUSY`, timeout, unplug, and partial-transfer behavior is considered.
- File descriptors and device handles are closed exactly once.
- Device-specific sequencing follows existing code or hardware documentation.

## Logging And Recoverability

- Error logs include enough context to identify the failed operation without flooding hot paths.
- Recovery path leaves the system in a known state.
- Watchdog, restart, and retry logic is bounded.
- The fix does not hide the original symptom by suppressing logs or swallowing errors.

## Final Classification

- `A: direct-pass`: Direct device/runtime verification exists.
- `B: surrogate-pass`: Build/test/replay/static proof exists, device verification pending.
- `C: analysis-only`: Reasoning only; external verification required.
