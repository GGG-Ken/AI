---
name: "bug-fixer-workflow"
description: "Professional Agentic Bug Fixing Workflow. Supports both Redmine issues and manual bug descriptions. Handles the full lifecycle: Analysis, Evidence Acquisition, Proposal, Fix Loop, and Submission across frontend, backend, and embedded scenarios."
triggers:
  - pattern: "修复问题\\s*#?(\\d+)"
    description: "Start fixing a Redmine issue (e.g., '修复问题 21660')"
  - pattern: "开始修复\\s*(.*)"
    description: "Start fixing a bug by description (e.g., '开始修复 音量滑块消失')"
  - pattern: "submit fix"
    description: "Submit the current fix"
---

# Bug Fixer Agent Skill

This skill transforms Codex into an autonomous Bug Fixing Agent. It follows a strict 5-Phase Workflow to ensure quality, explicit verification boundaries, and correct status reporting.

## Setup

Before using any Redmine-related script:

1. Copy `.bugfix-config.example.json` to `.bugfix-config.json`
2. Fill in your own Redmine `baseUrl`, `username`, and `password`
3. Keep `.bugfix-config.json` local only; do not commit real credentials
4. If your workflow needs a pending verification state, set `status.verificationPending` to the correct Redmine status ID

All scripts must read credentials from `.bugfix-config.json`. Do not hardcode user-specific values anywhere else in the skill.

## 🟢 Phase 0: Capability Check

**Goal**: Determine what environment the agent can actually access before making verification claims.

1. **Classify Access Mode**:
   * `direct`: The agent can access the target runtime directly, such as local app, simulator, remote shell, serial console, or device lab.
   * `assisted`: The agent cannot operate the runtime directly, but has supporting evidence such as logs, recordings, crash dumps, packet captures, or a human who can execute validation steps.
   * `offline`: The agent only has issue description, source code, attachments, and static artifacts.
2. **Record Verification Boundary**:
   * State which environment is reachable.
   * State which environment is not reachable.
   * State who owns final runtime validation if the agent cannot complete it.

**Deliverable to User**:
> 🧭 **Capability Check**
> *   **Access Mode**: [direct / assisted / offline]
> *   **Reachable Evidence**: [logs / screenshots / dump / unit test / simulator / none]
> *   **Verification Owner**: [agent / tester / user / device owner]
> *   **Gap**: [what cannot be verified in the current environment]

---

## 🟢 Phase 1: Input & Analysis

**Goal**: Understand the bug and obtain "Fail" evidence or equivalent failure proof.

1. **Context Acquisition**:
   * Call `node scripts/get_task_context.mjs <INPUT>`
   * This tool handles both Redmine IDs (fetches details/attachments) and text descriptions.
2. **Code Analysis**:
   * Read the issue details, description, attachments, and available evidence.
   * Search the codebase (`rg`, `glob`) to locate relevant files and logic.
3. **Evidence Acquisition (MANDATORY)**:
   * You MUST attempt to obtain failure evidence before fixing.
   * Acceptable evidence includes:
   * runtime logs, serial logs, crash stacks, dumps
   * screenshots, videos, packet captures, protocol samples
   * reproduction scripts, unit tests, simulator output, host-side replay results
   * user-provided operation steps with observable failure result
   * If direct reproduction is impossible, you MUST say so explicitly and continue as an analysis-driven fix with documented risk.

**Deliverable to User**:
> 🔍 **Analysis Report**
> *   **Target**: [Issue ID / Description]
> *   **Access Mode**: [direct / assisted / offline]
> *   **Locate**: [Files]
> *   **Fail Evidence**: [Log / Screenshot / Dump / Repro script / "Unavailable, using analysis-driven fix"]

---

## 🟡 Phase 2: Proposal

**Goal**: Plan the fix and get user approval.

1. **Root Cause Analysis**: Explain *why* the bug is happening based on evidence and code analysis.
2. **Solution Design**:
   * Describe the logic changes.
   * Show a `diff` preview if possible.
3. **Verification Strategy (MANDATORY)**:
   * Define how the fix will be checked within the current access boundary.
   * Split the plan into:
   * direct verification: device, simulator, browser, remote shell, serial console
   * surrogate verification: unit test, integration test, replay script, mock, log assertion
   * external verification: user, tester, or onsite engineer follow-up steps
   * State the expected evidence for each verification path.

**Deliverable to User**:
> 💡 **Fix Proposal**
> *   **Cause**: ...
> *   **Solution**: ...
> *   **Verification Plan**: [direct / surrogate / external]
> *   **Open Risk**: [what still cannot be proven locally]
>
> **Do you want to proceed? (Y/N)**

---

## 🔵 Phase 3: Execution & Loop

**Goal**: Fix the bug and obtain the strongest reachable "Pass" evidence.

**Upon User Confirmation (Y)**:

1. **Initialize Environment**:
   * Call `node scripts/init_fix_environment.mjs <ISSUE_ID>`
   * This creates or switches the branch and updates Redmine status (if applicable).

2. **Fix Loop (The "Agentic" Part)**:
   * **Edit**: Apply your fix to the code.
   * **Build**: Run the relevant build or static checks to ensure no syntax or type errors.
   * **Reachable Verification (MANDATORY)**: You MUST verify within the environment you can actually access before claiming completion.

        **Verification Requirements:**
        1. Re-check the original failure path if the current environment allows it
        2. Verify the changed behavior with the best reachable method
        3. Check related behavior to reduce regression risk
        4. Capture evidence: logs, screenshots, test output, replay result, or a precise manual verification package

        **Common Verification Scenarios:**
        - UI bug with browser access -> browser tools, screenshots, network inspection
        - API or backend bug -> request or response assertions, logs, integration checks
        - Embedded bug with device access -> serial log, shell output, simulator result, hardware test log
        - Embedded bug without device access -> host-side unit test, protocol replay, parser test, state-machine replay, verification checklist for onsite execution

   * **Check**:
        * If fail: analyze why, edit code, retry.
        * If pass within reachable scope: proceed to Phase 4 with the correct verification level.

**⚠️ CRITICAL**: You CANNOT proceed to Phase 4 unless:
- ✅ Code changes are complete
- ✅ Relevant build or checks passed
- ✅ Reachable verification is completed and documented
- ✅ Evidence or verification package is captured
- ✅ Uncovered validation gaps are stated explicitly

**Verification Levels**:
- `A: direct-pass` -> direct runtime verification passed
- `B: surrogate-pass` -> indirect verification passed, but runtime or device verification is still pending
- `C: analysis-only` -> fix is based on code analysis, with no executable runtime proof

**Deliverable to User**:
> 🔧 **Fix Verified**
> *   **Branch**: `fix/...`
> *   **Build Status**: ✅ Passed
> *   **Verification Level**: [A / B / C]
> *   **Evidence**: [Screenshot / Log / Test output / Verification package]
> *   **Uncovered Gap**: [what still needs external confirmation]

---

## 🟣 Phase 4: Commit & Record

**Goal**: Finalize the work with separate Git commit and Redmine update, using a status that matches the evidence strength.

**Prerequisites (MUST be satisfied before Phase 4)**:
- ✅ Code changes completed
- ✅ Relevant build or checks passed
- ✅ Reachable verification completed with evidence or verification package
- ✅ Verification level documented

1. **Git Commit** (FIRST):
   * Call `node scripts/git_commit.mjs <ISSUE_ID> [CHANGES_SUMMARY]`
   * **Inputs**:
   * `ISSUE_ID`: The issue ID.
   * `CHANGES_SUMMARY`: Optional brief summary of code changes.
   * **Output**: Creates a Git commit with format: `fix(scope): #ID Subject`

2. **Redmine Update** (SECOND):
   * Call `node scripts/update_redmine.mjs <ISSUE_ID> <ROOT_CAUSE> <SOLUTION> <TIME_SPENT> [--status <alias|id>] [--verification-mode <direct|assisted|offline>] [--verification-result <passed|pending|analysis>] [--verification-summary <text>] [--open-risks <text>]`
   * Choose status according to verification strength:
   * `A: direct-pass` -> use `resolved`
   * `B: surrogate-pass` -> use `verificationPending` or explicit Redmine status ID for "待测试验证/待现场验证"
   * `C: analysis-only` -> keep `inProgress`, or use an explicit review or confirmation status if your workflow defines one

**IMPORTANT**:
- Git commit message is separate from Redmine notes
- Redmine notes must state verification method, scope, evidence, and remaining gaps
- Never write "已修复" unless the current verification level justifies it

**Deliverable to User**:
> ✅ **Task Completed**
> *   **Git Commit**: Created with code changes summary
> *   **Redmine Status**: [resolved / pending verification / in progress]
> *   **Verification Level**: [A / B / C]
> *   **Next Steps**: [push / create PR / ask onsite tester to validate]

---

## Tools Reference

All tools are located in `scripts/`.

| Tool | Purpose | Usage |
| :--- | :--- | :--- |
| `get_task_context.mjs` | Read issue info (Redmine/Local) | `node .../get_task_context.mjs "21660"` |
| `init_fix_environment.mjs` | Setup branch & status | `node .../init_fix_environment.mjs "21660"` |
| `git_commit.mjs` | Create Git commit | `node .../git_commit.mjs "21660" "简短改动描述"` |
| `update_redmine.mjs` | Update Redmine status and notes | `node .../update_redmine.mjs "21660" "原因" "方案" "0 天 2 时" --status verificationPending --verification-mode assisted --verification-result pending --verification-summary "完成主机侧回放验证，待现场设备复测"` |

---

## Best Practices for Agent

*   **Evidence First**: Never claim a bug is fixed without a verification step, even if the evidence is only indirect.
*   **Boundary First**: State clearly what you can and cannot verify in the current environment.
*   **Strongest Reachable Proof**: Prefer direct runtime validation, but fall back to surrogate validation instead of blocking on unavailable hardware.
*   **Status Must Match Evidence**: `resolved` is only for direct verified fixes. Hardware-unreachable fixes must use a pending verification status or remain in progress.
*   **Self-Correction**: If the build fails or reachable verification fails, fix it yourself before asking the user.
*   **Atomic Tools**: Use the provided `scripts/*.mjs` tools for workflow state changes; do not use raw `git` commands for branching or committing if the tools cover it.
