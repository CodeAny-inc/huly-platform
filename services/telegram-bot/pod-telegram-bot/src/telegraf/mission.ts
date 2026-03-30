import { AccountUuid, Ref, WorkspaceUuid, concatLink, type Doc } from '@hcengineering/core'
import type { MeasureContext } from '@hcengineering/core'
import type { CreateMissionRequest } from '@hcengineering/ai-bot'
import type { StorageAdapter } from '@hcengineering/server-core'
import { generateToken } from '@hcengineering/server-token'
import tracker, { type Issue, type Project } from '@hcengineering/tracker'

import config from '../config'
import { WorkspaceClient } from '../workspace'
import type { ParsedMissionCommand } from './missionParse'

export type { ParsedMissionCommand } from './missionParse'

function resolveProject (projects: Project[], query: string): { project?: Project; matches: number } {
  const q = query.trim().toLowerCase()
  const matches = projects.filter((p) => {
    const idStr = String(p.identifier ?? '').toLowerCase()
    const nameStr = String(p.name ?? '').toLowerCase()
    return idStr === q || nameStr === q || String(p._id) === query
  })
  return { project: matches[0], matches: matches.length }
}

function resolveTask (issues: Issue[], query: string): { task?: Issue; matches: number } {
  const q = query.trim().toLowerCase()
  const matches = issues.filter((i) => {
    const ident = String(i.identifier ?? '').toLowerCase()
    return ident === q || String(i._id) === query
  })
  return { task: matches[0], matches: matches.length }
}

export async function runMissionFromTelegram (params: {
  ctx: MeasureContext
  storage: StorageAdapter
  workspace: WorkspaceUuid
  account: AccountUuid
  parsed: ParsedMissionCommand
  sourceRef: string
}): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  if (config.AiBotUrl === '') {
    return { ok: false, error: 'AI_BOT_URL is not configured on telegram-bot' }
  }

  const ws = await WorkspaceClient.create(params.workspace, params.account, params.ctx, params.storage)
  const projects = await ws.findProjects()
  const { project, matches: pm } = resolveProject(projects, params.parsed.project)

  if (pm === 0 || project === undefined) {
    return { ok: false, error: `Project not found: ${params.parsed.project}` }
  }
  if (pm > 1) {
    return { ok: false, error: `Multiple projects match "${params.parsed.project}"` }
  }

  let taskId: Ref<Issue> | undefined
  if (params.parsed.scope === 'task' && params.parsed.task !== undefined) {
    const issues = await ws.findIssuesInProject(project._id)
    const { task, matches: tm } = resolveTask(issues, params.parsed.task)
    if (tm === 0 || task === undefined) {
      return { ok: false, error: `Task not found: ${params.parsed.task}` }
    }
    if (tm > 1) {
      return { ok: false, error: `Multiple tasks match "${params.parsed.task}"` }
    }
    taskId = task._id
  }

  const target: CreateMissionRequest['target'] =
    params.parsed.scope === 'todo' || params.parsed.scope === 'backlog'
      ? {
          type: 'bucket',
          projectId: project._id as unknown as Ref<Doc>,
          bucket: params.parsed.scope
        }
      : params.parsed.scope === 'task' && taskId !== undefined
        ? {
            type: 'task',
            projectId: project._id as unknown as Ref<Doc>,
            taskId: taskId as unknown as Ref<Doc>
          }
        : {
            type: 'project',
            projectId: project._id as unknown as Ref<Doc>
          }

  const body: CreateMissionRequest = {
    source: 'telegram',
    sourceRef: params.sourceRef,
    agentProfileId: params.parsed.agent,
    executorType: 'codex-cli',
    target,
    userPrompt: params.parsed.userPrompt.length > 0 ? params.parsed.userPrompt : 'Analyze and summarize.'
  }

  const token = generateToken(params.account, params.workspace, { service: 'telegram-bot' })
  const url = concatLink(config.AiBotUrl.replace(/\/$/, ''), '/missions')
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    return { ok: false, error: (data as { message?: string }).message ?? resp.statusText }
  }

  const mission = data as { status?: string; resultSummary?: string; errorMessage?: string }
  if (mission.status === 'failed') {
    return { ok: false, error: mission.errorMessage ?? 'Mission failed' }
  }
  return { ok: true, summary: mission.resultSummary ?? '(no summary)' }
}
