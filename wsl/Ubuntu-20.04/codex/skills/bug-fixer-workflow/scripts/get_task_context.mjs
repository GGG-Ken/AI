#!/usr/bin/env node
/**
 * get_task_context.mjs - Agent Tool
 * Normalizes input (Redmine ID or Text) into a standard task context.
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
  positional: ['INPUT'],
})
const input = args.INPUT

if (!input) {
  console.error('Usage: node get_task_context.mjs <INPUT_STRING>')
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
    let result = {}
    const redmineIdMatch = input.match(/^#?(\d{4,6})$/)

    if (redmineIdMatch) {
      // --- Case A: Redmine Issue ---
      const issueId = redmineIdMatch[1]
      console.error(`Detected Redmine ID: ${issueId}`) // Log to stderr to not pollute stdout JSON

      const data = await getIssueDetails(issueId)
      if (!data || !data.issue) {
        throw new Error(`Redmine issue #${issueId} not found`)
      }

      // Prepare Workspace
      const issueDir = join(WORKSPACE, 'issues', issueId)
      mkdirSync(issueDir, { recursive: true })
      writeFileSync(join(issueDir, 'info.json'), JSON.stringify(data, null, 2), 'utf8')

      // Download Attachments
      const attachmentsDir = join(issueDir, 'attachments')
      mkdirSync(attachmentsDir, { recursive: true })
      const localAttachments = await downloadAttachments(
        issueId,
        attachmentsDir,
        data.issue.attachments,
      )

      result = {
        type: 'redmine',
        id: String(data.issue.id),
        subject: data.issue.subject,
        description: data.issue.description,
        status: data.issue.status.name,
        attachments: localAttachments,
        workspace_dir: issueDir,
      }
    } else {
      // --- Case B: Local/Manual Description ---
      console.error(`Detected Manual Description`)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const fakeId = `local-${timestamp}`

      // Create a clean slug from description for folder name
      const slug = input.slice(0, 30).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')

      const issueDir = join(WORKSPACE, 'issues', fakeId)
      mkdirSync(issueDir, { recursive: true })

      const localIssueData = {
        issue: {
          id: fakeId,
          subject: input,
          description: input,
          status: {
            name: 'New',
          },
        },
      }
      writeFileSync(join(issueDir, 'info.json'), JSON.stringify(localIssueData, null, 2), 'utf8')

      result = {
        type: 'local',
        id: fakeId,
        subject: input, // Use input as subject
        description: input, // Use input as description
        status: 'New',
        attachments: [],
        workspace_dir: issueDir,
      }
    }

    // Output JSON for Agent
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }
}

main()
