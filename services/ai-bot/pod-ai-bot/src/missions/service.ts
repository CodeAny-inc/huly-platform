import { isWorkspaceLoginInfo } from '@hcengineering/account-client'
import type {
  AgentProfileRecord,
  CreateMissionRequest,
  ExecutorResourceRecord,
  ExecutorType,
  MissionRecord
} from '@hcengineering/ai-bot'
import {
  AccountRole,
  MeasureContext,
  PersonUuid,
  Ref,
  WorkspaceUuid,
  generateId,
  systemAccountUuid
} from '@hcengineering/core'
import { getAccountClient } from '@hcengineering/server-client'
import setting from '@hcengineering/setting'
import telegram from '@hcengineering/telegram'
import tracker, { type Issue, type Project } from '@hcengineering/tracker'

import config from '../config'
import { DbStorage } from '../storage'
import { AgentProfileDoc, ExecutorResourceDoc, MissionDoc } from '../types'
import { WorkspaceClient } from '../workspace/workspaceClient'
import { buildMissionContext, formatContextForPrompt } from './context'
import { resolveMissionExecutor } from './executorResolve'
import { filterExecutorEnv, runAllowlistedExecutor } from './executors'
import { normalizeMissionMarkdown } from './output'
import { missionError } from './types'

function now (): number {
  return Date.now()
}

function canUsePrivateExecutor (ownerId: string, account: PersonUuid, role: AccountRole): boolean {
  return (
    account === (ownerId as PersonUuid) ||
    role === AccountRole.Owner ||
    role === AccountRole.Admin ||
    role === AccountRole.Maintainer
  )
}

export class MissionService {
  private readonly activeRuns = new Map<string, number>()

  constructor (
    private readonly ctx: MeasureContext,
    private readonly storage: DbStorage,
    private readonly getWorkspaceClient: (ws: WorkspaceUuid) => Promise<WorkspaceClient | undefined>
  ) {}

  private bumpRun (executorId: string, delta: number): void {
    const v = (this.activeRuns.get(executorId) ?? 0) + delta
    if (v <= 0) this.activeRuns.delete(executorId)
    else this.activeRuns.set(executorId, v)
  }

  async getWorkspaceRole (userToken: string): Promise<AccountRole> {
    const info = await getAccountClient(userToken).getLoginInfoByToken()
    if (!isWorkspaceLoginInfo(info)) {
      throw missionError('Invalid workspace token', 'UNAUTHORIZED')
    }
    return info.role
  }

  async listAgentProfiles (workspaceId: WorkspaceUuid): Promise<AgentProfileRecord[]> {
    const docs = await this.storage.listAgentProfiles(workspaceId)
    return docs.map((d) => this.stripAgent(d))
  }

  async createAgentProfile (
    workspaceId: WorkspaceUuid,
    account: PersonUuid,
    input: Omit<AgentProfileRecord, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'createdBy'>
  ): Promise<AgentProfileRecord> {
    const id = generateId()
    const t = now()
    const doc: AgentProfileDoc = {
      ...input,
      _id: id,
      id,
      workspaceId,
      createdBy: account as unknown as string,
      createdAt: t,
      updatedAt: t
    }
    await this.storage.insertAgentProfile(doc)
    return this.stripAgent(doc)
  }

  async updateAgentProfile (
    workspaceId: WorkspaceUuid,
    id: string,
    patch: Partial<AgentProfileRecord>
  ): Promise<AgentProfileRecord | undefined> {
    const existing = await this.storage.getAgentProfile(workspaceId, id)
    if (existing === undefined) return undefined
    await this.storage.updateAgentProfile(workspaceId, id, { ...patch, id, workspaceId })
    const next = await this.storage.getAgentProfile(workspaceId, id)
    return next !== undefined ? this.stripAgent(next) : undefined
  }

  async deleteAgentProfile (workspaceId: WorkspaceUuid, id: string): Promise<boolean> {
    const r = await this.storage.getAgentProfile(workspaceId, id)
    if (r === undefined) return false
    await this.storage.deleteAgentProfile(workspaceId, id)
    return true
  }

  private stripAgent (d: AgentProfileDoc): AgentProfileRecord {
    const { _id, ...rest } = d
    return rest
  }

  async listExecutorResources (workspaceId: WorkspaceUuid, account: PersonUuid, role: AccountRole): Promise<ExecutorResourceRecord[]> {
    const all = await this.storage.listExecutorResources(workspaceId)
    const result: ExecutorResourceRecord[] = []
    for (const e of all) {
      if (e.visibility === 'private' && !canUsePrivateExecutor(e.ownerId, account, role)) {
        continue
      }
      result.push(this.toExecutorDto(e))
    }
    return result
  }

  async listExecutorResourcesAdmin (workspaceId: WorkspaceUuid): Promise<ExecutorResourceRecord[]> {
    const all = await this.storage.listExecutorResources(workspaceId)
    return all.map((e) => this.toExecutorDto(e))
  }

  private toExecutorDto (e: ExecutorResourceDoc): ExecutorResourceRecord {
    const active = this.activeRuns.get(e.id) ?? 0
    return {
      id: e.id,
      workspaceId: e.workspaceId,
      type: e.type,
      name: e.name,
      visibility: e.visibility,
      ownerId: e.ownerId,
      enabled: e.enabled,
      mappedCommandId: e.mappedCommandId,
      envRef: e.envRef,
      maxConcurrentRuns: e.maxConcurrentRuns,
      activeRuns: active,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt
    }
  }

  async createExecutorResource (
    workspaceId: WorkspaceUuid,
    account: PersonUuid,
    input: Omit<ExecutorResourceRecord, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'activeRuns' | 'mappedCommandId'> & {
      mappedCommandId?: ExecutorType
    }
  ): Promise<ExecutorResourceRecord> {
    const id = generateId()
    const t = now()
    const mappedCommandId = input.mappedCommandId ?? input.type
    const ownerId =
      input.visibility === 'private'
        ? (account as unknown as string)
        : (systemAccountUuid as unknown as string)
    const doc: ExecutorResourceDoc = {
      ...input,
      mappedCommandId,
      _id: id,
      id,
      workspaceId,
      ownerId,
      createdAt: t,
      updatedAt: t
    }
    await this.storage.insertExecutorResource(doc)
    return this.toExecutorDto(doc)
  }

  async updateExecutorResource (
    workspaceId: WorkspaceUuid,
    id: string,
    account: PersonUuid,
    role: AccountRole,
    patch: Partial<ExecutorResourceRecord>
  ): Promise<ExecutorResourceRecord | undefined> {
    const existing = await this.storage.getExecutorResource(workspaceId, id)
    if (existing === undefined) return undefined
    if (existing.visibility === 'private' && !canUsePrivateExecutor(existing.ownerId, account, role)) {
      throw missionError('Cannot update this executor', 'FORBIDDEN')
    }
    const { activeRuns: _a, id: _i, workspaceId: _w, mappedCommandId, ...safe } = patch
    await this.storage.updateExecutorResource(workspaceId, id, {
      ...safe,
      ...(mappedCommandId !== undefined ? { mappedCommandId: existing.type } : {})
    })
    const next = await this.storage.getExecutorResource(workspaceId, id)
    return next !== undefined ? this.toExecutorDto(next) : undefined
  }

  async deleteExecutorResource (
    workspaceId: WorkspaceUuid,
    id: string,
    account: PersonUuid,
    role: AccountRole
  ): Promise<boolean> {
    const existing = await this.storage.getExecutorResource(workspaceId, id)
    if (existing === undefined) return false
    if (existing.visibility === 'private' && !canUsePrivateExecutor(existing.ownerId, account, role)) {
      throw missionError('Cannot delete this executor', 'FORBIDDEN')
    }
    await this.storage.deleteExecutorResource(workspaceId, id)
    return true
  }

  async createAndRunMission (params: {
    workspaceId: WorkspaceUuid
    account: PersonUuid
    userToken: string
    req: CreateMissionRequest
  }): Promise<MissionRecord> {
    const { workspaceId, account, userToken, req } = params
    const role = await this.getWorkspaceRole(userToken)

    let profile = await this.storage.getAgentProfile(workspaceId, req.agentProfileId)
    if (profile === undefined) {
      const all = await this.storage.listAgentProfiles(workspaceId)
      const key = req.agentProfileId.trim()
      profile =
        all.find((p) => p.name.toLowerCase() === key.toLowerCase()) ??
        all.find((p) => p.role === key || p.role === (key.toUpperCase() as any))
    }
    if (profile === undefined || !profile.isActive) {
      throw missionError('Agent profile not found or inactive', 'BAD_PROFILE')
    }

    const executors = await this.storage.listExecutorResources(workspaceId)
    const executor = resolveMissionExecutor({
      workspaceId,
      account,
      role,
      profile,
      req,
      allRaw: executors,
      activeRuns: this.activeRuns
    })

    const missionId = generateId()
    const t0 = now()
    const missionPartial: MissionDoc = {
      _id: missionId,
      id: missionId,
      workspaceId,
      source: req.source,
      sourceRef: req.sourceRef,
      requestedBy: account as unknown as string,
      agentProfileId: profile.id,
      executorResourceId: executor.id,
      target: req.target,
      userPrompt: req.userPrompt,
      status: 'running',
      createdAt: t0,
      updatedAt: t0
    }
    await this.storage.insertMission({ ...missionPartial })

    const wsClient = await this.getWorkspaceClient(workspaceId)
    if (wsClient === undefined) {
      await this.failMission(workspaceId, missionId, 'Workspace client not available')
      const m = await this.storage.getMission(workspaceId, missionId)
      return this.missionToRecord(m!)
    }

    this.bumpRun(executor.id, 1)
    try {
      const target = req.target
      if (target.projectId === undefined) {
        throw missionError('target.projectId is required', 'INVALID_TARGET')
      }
      const projectId = target.projectId as Ref<Project>

      const op = await wsClient.opClient
      const ctxPayload = await buildMissionContext(op, wsClient.wsIds, {
        targetType: target.type,
        projectId,
        taskId: target.taskId as Ref<Issue> | undefined,
        bucket: target.bucket
      })

      if (ctxPayload.postToTaskId === undefined) {
        throw missionError('No task to attach mission result to (empty scope)', 'NO_CONTEXT')
      }

      const systemPrompt = [
        'You are an AI agent executing a read-only analysis mission inside Huly.',
        `Agent role: ${profile.role}.`,
        profile.personaPrompt.length > 0 ? `Persona:\n${profile.personaPrompt}` : '',
        '',
        'Context (read-only, truncated):',
        formatContextForPrompt(ctxPayload),
        '',
        'User request:',
        req.userPrompt,
        '',
        'Respond with markdown EXACTLY in this structure:',
        '# Mission Result',
        '## Summary',
        '...',
        '## Findings',
        '- ...',
        '## Risks / Blockers',
        '- ...',
        '## Recommended Next Actions',
        '1. ...',
        '## Confidence',
        'High / Medium / Low'
      ].join('\n')

      const childEnv = filterExecutorEnv(executor.envRef, process.env)
      const execResult = await runAllowlistedExecutor({
        type: executor.mappedCommandId,
        promptStdin: systemPrompt,
        env: childEnv
      })

      const combined =
        execResult.exitCode !== 0
          ? `Executor exited with code ${execResult.exitCode}\n${execResult.stderr}\n${execResult.stdout}`
          : execResult.stdout + (execResult.stderr.length > 0 ? `\n${execResult.stderr}` : '')

      const { markdown, summary } = normalizeMissionMarkdown(combined, config.MissionOutputMaxBytes)

      await wsClient.postMissionResultMarkdown({
        projectId,
        postToIssueId: ctxPayload.postToTaskId,
        markdown,
        missionId
      })

      await this.storage.updateMission(workspaceId, missionId, {
        status: 'completed',
        resultSummary: summary,
        resultMarkdown: markdown,
        errorMessage: execResult.exitCode !== 0 ? `Non-zero exit: ${execResult.exitCode}` : undefined
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.ctx.error('mission failed', { err })
      await this.failMission(workspaceId, missionId, msg)
    } finally {
      this.bumpRun(executor.id, -1)
    }

    const final = await this.storage.getMission(workspaceId, missionId)
    if (final === undefined) {
      throw missionError('Mission record lost', 'INTERNAL')
    }
    return this.missionToRecord(final)
  }

  private async failMission (workspaceId: WorkspaceUuid, missionId: string, message: string): Promise<void> {
    await this.storage.updateMission(workspaceId, missionId, {
      status: 'failed',
      errorMessage: message,
      resultSummary: undefined,
      resultMarkdown: undefined
    })
  }

  private missionToRecord (m: MissionDoc): MissionRecord {
    const { _id, ...rest } = m
    return rest
  }

  async getMission (workspaceId: WorkspaceUuid, id: string): Promise<MissionRecord | undefined> {
    const m = await this.storage.getMission(workspaceId, id)
    return m !== undefined ? this.missionToRecord(m) : undefined
  }

  async listMissions (workspaceId: WorkspaceUuid): Promise<MissionRecord[]> {
    const ms = await this.storage.listMissions(workspaceId)
    return ms.map((m) => this.missionToRecord(m))
  }

  async getChannelStatus (workspaceId: WorkspaceUuid): Promise<{ telegram: 'connected' | 'not_connected' }> {
    const ws = await this.getWorkspaceClient(workspaceId)
    if (ws === undefined) {
      return { telegram: 'not_connected' }
    }
    const op = await ws.opClient
    const integrations = await op.findAll(setting.class.Integration, {})
    const tg = integrations.find((i) => i.type === telegram.integrationType.Telegram)
    const connected = tg !== undefined && !tg.disabled && (tg.value?.length ?? 0) > 0
    return { telegram: connected ? 'connected' : 'not_connected' }
  }
}
