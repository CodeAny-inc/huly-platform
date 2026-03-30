import type { CreateMissionRequest, ExecutorResourceRecord, ExecutorType } from '@hcengineering/ai-bot'
import { AccountRole, PersonUuid, WorkspaceUuid } from '@hcengineering/core'

import type { AgentProfileDoc, ExecutorResourceDoc } from '../types'
import { missionError } from './types'

function isAdminOrOwner (role: AccountRole): boolean {
  return role === AccountRole.Owner || role === AccountRole.Admin || role === AccountRole.Maintainer
}

function canUsePrivateExecutor (ownerId: string, account: PersonUuid, role: AccountRole): boolean {
  return account === (ownerId as PersonUuid) || isAdminOrOwner(role)
}

/**
 * Pure executor resolution for missions (used by MissionService and unit tests).
 * Precedence: explicit id → profile default → first eligible shared executor of requested type.
 */
export function resolveMissionExecutor (params: {
  workspaceId: WorkspaceUuid
  account: PersonUuid
  role: AccountRole
  profile: AgentProfileDoc
  req: CreateMissionRequest
  allRaw: ExecutorResourceDoc[]
  activeRuns: Map<string, number>
}): ExecutorResourceRecord {
  const { workspaceId, account, role, profile, req, allRaw, activeRuns } = params

  const enabled = allRaw.filter((e) => e.workspaceId === workspaceId && e.enabled)

  const tryPick = (id: string | undefined): ExecutorResourceDoc | undefined => {
    if (id === undefined) return undefined
    const e = enabled.find((x) => x.id === id)
    if (e === undefined) return undefined
    if (e.visibility === 'private' && !canUsePrivateExecutor(e.ownerId, account, role)) return undefined
    const active = activeRuns.get(e.id) ?? 0
    if (active >= e.maxConcurrentRuns) return undefined
    return e
  }

  if (req.executorResourceId !== undefined) {
    const e = tryPick(req.executorResourceId)
    if (e === undefined) {
      throw missionError('Selected executor is unavailable, disabled, busy, or not accessible', 'EXECUTOR_UNAVAILABLE')
    }
    return e
  }

  if (profile.defaultExecutorId !== undefined) {
    const e = tryPick(profile.defaultExecutorId)
    if (e !== undefined) return e
  }

  const defaultDoc =
    profile.defaultExecutorId !== undefined ? enabled.find((x) => x.id === profile.defaultExecutorId) : undefined

  const wantType: ExecutorType | undefined = req.executorType ?? defaultDoc?.type

  if (wantType === undefined) {
    throw missionError(
      'Set executorType on the request, or configure a resolvable default executor on the agent profile',
      'NO_EXECUTOR'
    )
  }

  for (const e of enabled) {
    if (e.visibility !== 'shared' || e.type !== wantType) continue
    const active = activeRuns.get(e.id) ?? 0
    if (active >= e.maxConcurrentRuns) continue
    return e
  }

  throw missionError(
    'No available shared executor for the requested type (all busy or none configured)',
    'NO_SHARED_EXECUTOR'
  )
}
