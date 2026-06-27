#!/usr/bin/env node
/**
 * init_fix_environment.mjs - Agent Tool
 * Creates git branch and updates Redmine status.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execCommand, getScriptDir, getProjectPaths, loadBugfixConfig, parseArgs, httpsRequest } from '../lib/utils.mjs';

const __dirname = getScriptDir(import.meta.url);
const { projectRoot: PROJECT_ROOT, workspace: WORKSPACE } = getProjectPaths(__dirname);

const args = parseArgs(process.argv.slice(2), {
  positional: ['ISSUE_ID'],
});
const issueId = args.ISSUE_ID;

if (!issueId) {
  console.error('Usage: node init_fix_environment.mjs <ISSUE_ID>');
  process.exit(1);
}

const BUGFIX_CONFIG = loadBugfixConfig(__dirname);
const REDMINE_CONFIG = BUGFIX_CONFIG.redmine;
const IN_PROGRESS_STATUS_ID = BUGFIX_CONFIG.status?.inProgress || 17;

function exec(command) {
  return execCommand(command, { cwd: PROJECT_ROOT });
}

async function setStatusInProgress(issueId) {
  const url = `${REDMINE_CONFIG.baseUrl}/issues/${issueId}.json`;
  await httpsRequest(url, {
    issue: { status_id: IN_PROGRESS_STATUS_ID }
  }, {
    auth: REDMINE_CONFIG,
    headers: { 'Accept': 'application/json' }
  });
}

async function main() {
  try {
    const branchName = `fix/issue-${issueId}`;
    console.log(`Initializing environment for Issue #${issueId}...`);

    // 1. Git Branch
    try {
      exec(`git rev-parse --verify "${branchName}"`);
      console.log(`Branch ${branchName} exists, checking out...`);
      exec(`git checkout ${branchName}`);
    } catch {
      console.log(`Creating new branch ${branchName}...`);
      exec(`git checkout -b ${branchName}`);
    }

    // 2. Redmine Status (Only for numeric IDs)
    if (/^\d+$/.test(issueId)) {
      try {
        await setStatusInProgress(issueId);
        console.log('Redmine status updated to "In Progress"');
      } catch (e) {
        console.warn(`Warning: Failed to update Redmine status: ${e.message}`);
      }
    } else {
      console.log('Skipping Redmine status update (Local/Manual issue).');
    }

    // 3. Workspace Record
    const issueDir = join(WORKSPACE, 'issues', issueId);
    mkdirSync(issueDir, { recursive: true });
    writeFileSync(join(issueDir, 'branch.txt'), branchName, 'utf8');

    console.log('Environment ready.');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
