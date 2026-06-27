#!/usr/bin/env node
/**
 * update_redmine.mjs - Redmine Update Tool
 * Updates Redmine issue status and notes according to verification strength.
 */

import { getScriptDir, loadBugfixConfig, parseArgs, httpsRequest } from '../lib/utils.mjs';

const __dirname = getScriptDir(import.meta.url);

const args = parseArgs(process.argv.slice(2), {
  named: [
    'status',
    'verification-mode',
    'verification-result',
    'verification-summary',
    'test-suggestion',
    'open-risks',
    'target-version',
    'gerrit-url',
  ],
  positional: ['ISSUE_ID', 'ROOT_CAUSE', 'SOLUTION', 'TIME_SPENT'],
});

const issueId = args.ISSUE_ID;
const rootCause = (args.ROOT_CAUSE || '').replace(/\\n/g, '\n');
const solution = (args.SOLUTION || '').replace(/\\n/g, '\n');
const timeSpent = args.TIME_SPENT || '0 天 0 时';
const statusArg = args.status;
const verificationMode = args['verification-mode'] || 'direct';
const verificationResult = args['verification-result'] || 'passed';
const verificationSummary = (args['verification-summary'] || '无').replace(/\\n/g, '\n');
const testSuggestion = (args['test-suggestion'] || '无').replace(/\\n/g, '\n');
const openRisks = (args['open-risks'] || '无').replace(/\\n/g, '\n');
const targetVersion = args['target-version'];
const gerritUrl = args['gerrit-url'] || '无';

if (!issueId || !rootCause || !solution) {
  console.error('Usage: node update_redmine.mjs <ISSUE_ID> <ROOT_CAUSE> <SOLUTION> [TIME_SPENT] [--status <alias|id>] [--verification-mode <direct|assisted|offline>] [--verification-result <passed|pending|analysis>] [--verification-summary <text>] [--test-suggestion <text>] [--open-risks <text>] [--target-version <text>] [--gerrit-url <url>]');
  console.error('Example: node update_redmine.mjs 21822 "状态机进入异常分支" "增加非法状态保护与日志" "0 天 2 时" --status verificationPending --verification-mode assisted --verification-result pending --verification-summary "主机侧回放通过，待设备复测"');
  process.exit(1);
}

const BUGFIX_CONFIG = loadBugfixConfig(__dirname);
const REDMINE_CONFIG = BUGFIX_CONFIG.redmine;
const RESOLVED_STATUS_ID = BUGFIX_CONFIG.status?.resolved || 9;
const IN_PROGRESS_STATUS_ID = BUGFIX_CONFIG.status?.inProgress || 17;
const VERIFICATION_PENDING_STATUS_ID = BUGFIX_CONFIG.status?.verificationPending;

function resolveStatusId(input, result) {
  if (input) {
    if (/^\d+$/.test(input)) {
      return Number(input);
    }

    const aliases = {
      resolved: RESOLVED_STATUS_ID,
      inProgress: IN_PROGRESS_STATUS_ID,
      verificationPending: VERIFICATION_PENDING_STATUS_ID,
      pending: VERIFICATION_PENDING_STATUS_ID,
    };

    const statusId = aliases[input];
    if (statusId) {
      return statusId;
    }

    throw new Error(`Unknown or unconfigured status alias: ${input}`);
  }

  if (result === 'passed') {
    return RESOLVED_STATUS_ID;
  }

  if (result === 'pending') {
    if (VERIFICATION_PENDING_STATUS_ID) {
      return VERIFICATION_PENDING_STATUS_ID;
    }
    throw new Error('verificationPending status is not configured. Pass --status <RedmineStatusId> or add status.verificationPending to .bugfix-config.json');
  }

  if (result === 'analysis') {
    return IN_PROGRESS_STATUS_ID;
  }

  throw new Error(`Unknown verification result: ${result}`);
}

function buildSelfTestConclusion(result, mode) {
  const modeText = {
    direct: '直接环境',
    assisted: '辅助证据',
    offline: '离线分析',
  }[mode] || mode;

  if (result === 'passed') {
    return `已在${modeText}完成验证，修复结果可直接提交。`;
  }

  if (result === 'pending') {
    return '已完成代码修复与可达范围验证，仍需在目标环境进一步验证。';
  }

  if (result === 'analysis') {
    return '已完成分析性修复，当前缺少可执行运行态验证。';
  }

  return result;
}

function buildTestSuggestion(baseSuggestion, summary, risks) {
  const parts = [];
  if (baseSuggestion && baseSuggestion !== '无') {
    parts.push(baseSuggestion);
  }
  if (summary && summary !== '无') {
    parts.push(`验证说明: ${summary}`);
  }
  if (risks && risks !== '无') {
    parts.push(`关注项: ${risks}`);
  }

  return parts.length > 0 ? parts.join('\n') : '无';
}

async function updateIssue(issueId, statusId, notes) {
  const url = `${REDMINE_CONFIG.baseUrl}/issues/${issueId}.json`;
  await httpsRequest(url, {
    issue: {
      status_id: statusId,
      notes: notes
    }
  }, {
    auth: REDMINE_CONFIG,
    headers: { 'Accept': 'application/json' }
  });
}

async function main() {
  try {
    const statusId = resolveStatusId(statusArg, verificationResult);
    console.log(`Updating Redmine Issue #${issueId} to status ${statusId}...`);

    const nextDay = new Date(Date.now() + 86400000);
    const nextDayStr = `${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
    const verificationTargetVersion = targetVersion || `${nextDayStr}及之后版本`;
    const selfTestConclusion = buildSelfTestConclusion(verificationResult, verificationMode);
    const finalTestSuggestion = buildTestSuggestion(testSuggestion, verificationSummary, openRisks);

    const notes = `**[解决用时]** ${timeSpent}

**[问题原因描述]**
${rootCause}

**[解决方案]**
${solution}

**[测试建议]**
${finalTestSuggestion}

**[Gerrit Change URL]**
${gerritUrl}

**[自测结论]**
${selfTestConclusion}

**[验证目标版本]**
${verificationTargetVersion}`;

    await updateIssue(issueId, statusId, notes);
    console.log(`✓ Issue #${issueId} updated in Redmine successfully`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
