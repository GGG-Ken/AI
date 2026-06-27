#!/usr/bin/env node
/**
 * fetch_issue_info.mjs - Agent Tool
 * Fetches issue details and attachments. READ-ONLY.
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  log,
  getScriptDir,
  getProjectPaths,
  loadBugfixConfig,
  parseArgs,
  httpsGet,
  httpsDownload,
} from '../lib/utils.mjs'

const __dirname = getScriptDir(import.meta.url)
const { workspace: WORKSPACE } = getProjectPaths(__dirname)

// Parse Args
const args = parseArgs(process.argv.slice(2), {
  positional: ['ISSUE_ID'],
})
const issueId = args.ISSUE_ID

if (!issueId) {
  console.error('Usage: node fetch_issue_info.mjs <ISSUE_ID>')
  process.exit(1)
}

const { redmine: REDMINE_CONFIG } = loadBugfixConfig(__dirname)

async function getIssueDetails(issueId) {
  const url = `${REDMINE_CONFIG.baseUrl}/issues/${issueId}.json?include=attachments`
  return await httpsGet(url, {
    auth: REDMINE_CONFIG,
    headers: { Accept: 'application/json' },
  })
}

async function downloadAttachments(issueId, attachmentsDir, attachments) {
  if (!attachments || attachments.length === 0) return []

  const downloadedFiles = []
  for (const attachment of attachments) {
    try {
      const downloadUrl = attachment.content_url.startsWith('http')
        ? attachment.content_url
        : `${REDMINE_CONFIG.baseUrl}${attachment.content_url}`

      const response = await httpsDownload(downloadUrl, { auth: REDMINE_CONFIG })
      const filepath = join(attachmentsDir, attachment.filename)
      writeFileSync(filepath, response)
      downloadedFiles.push(filepath)
    } catch (err) {
      console.error(`Failed to download ${attachment.filename}: ${err.message}`)
    }
  }
  return downloadedFiles
}

async function main() {
  try {
    // 1. Fetch Details
    const data = await getIssueDetails(issueId)
    if (!data || !data.issue) {
      throw new Error('Issue not found')
    }

    // 2. Prepare Workspace
    const issueDir = join(WORKSPACE, 'issues', issueId)
    mkdirSync(issueDir, { recursive: true })
    writeFileSync(join(issueDir, 'info.json'), JSON.stringify(data, null, 2), 'utf8')

    // 3. Download Attachments
    const attachmentsDir = join(issueDir, 'attachments')
    mkdirSync(attachmentsDir, { recursive: true })
    const localAttachments = await downloadAttachments(
      issueId,
      attachmentsDir,
      data.issue.attachments,
    )

    // 4. Output JSON for Agent
    const result = {
      id: data.issue.id,
      subject: data.issue.subject,
      description: data.issue.description,
      status: data.issue.status.name,
      priority: data.issue.priority.name,
      author: data.issue.author.name,
      created_on: data.issue.created_on,
      attachments: localAttachments,
      workspace_dir: issueDir,
    }

    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }
}

main()
