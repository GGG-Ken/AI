#!/usr/bin/env node
/**
 * git_commit.mjs - Git Commit Tool
 * Creates a git commit with proper formatting.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { execCommand, getScriptDir, getProjectPaths, parseArgs } from '../lib/utils.mjs'

const __dirname = getScriptDir(import.meta.url)
const { projectRoot: PROJECT_ROOT, workspace: WORKSPACE } = getProjectPaths(__dirname)

const args = parseArgs(process.argv.slice(2), {
  positional: ['ISSUE_ID', 'CHANGES_SUMMARY'],
})

const issueId = args.ISSUE_ID
const changesSummary = args.CHANGES_SUMMARY || ''

if (!issueId) {
  console.error('Usage: node git_commit.mjs <ISSUE_ID> [CHANGES_SUMMARY]')
  console.error('Example: node git_commit.mjs 21822 "移除deep watch,拆分为8个独立watch"')
  process.exit(1)
}

function exec(command) {
  return execCommand(command, { cwd: PROJECT_ROOT })
}

async function main() {
  try {
    // Check for staged or unstaged changes
    const hasUnstaged = exec('git diff --name-only').trim()
    const hasStaged = exec('git diff --cached --name-only').trim()

    if (!hasUnstaged && !hasStaged) {
      console.log('No changes to commit.')
      return
    }

    // Get issue subject from workspace
    let subject = 'Unknown issue'
    const infoFile = join(WORKSPACE, 'issues', issueId, 'info.json')
    if (existsSync(infoFile)) {
      try {
        const data = JSON.parse(readFileSync(infoFile, 'utf8'))
        subject = data.issue?.subject || data.subject || 'Unknown issue'
      } catch {}
    }

    // Build commit message
    let commitMsg = `fix(scope): #${issueId} ${subject}`

    if (changesSummary) {
      commitMsg += `\n\n${changesSummary}`
    }

    // Stage and commit
    if (hasUnstaged) exec('git add -A')
    exec(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`)

    console.log('✓ Git commit created successfully')
    console.log(`Commit: ${commitMsg.split('\n')[0]}`)
  } catch (error) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }
}

main()
