import type { CreateMissionRequest } from '@hcengineering/ai-bot'
import { AccountRole } from '@hcengineering/core'

import type { AgentProfileDoc, ExecutorResourceDoc } from '../../types'
import { resolveMissionExecutor } from '../executorResolve'
import type { MissionError } from '../types'

const WS = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' as any
const USER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' as any
const OTHER = 'cccccccc-cccc-cccc-cccc-cccccccccccc' as any

function ex (partial: Partial<ExecutorResourceDoc> & Pick<ExecutorResourceDoc, 'id' | 'type' | 'visibility'>): ExecutorResourceDoc {
  return {
    workspaceId: WS,
    name: 'x',
    ownerId: USER as unknown as string,
    enabled: true,
    mappedCommandId: partial.type,
    envRef: [],
    maxConcurrentRuns: 1,
    createdAt: 0,
    updatedAt: 0,
    _id: partial.id,
    ...partial
  } as ExecutorResourceDoc
}

function profile (partial: Partial<AgentProfileDoc> & Pick<AgentProfileDoc, 'id'>): AgentProfileDoc {
  return {
    workspaceId: WS,
    name: 'P',
    role: 'CTO',
    personaPrompt: '',
    defaultMissionMode: 'analysis',
    isActive: true,
    createdBy: USER as unknown as string,
    createdAt: 0,
    updatedAt: 0,
    _id: partial.id,
    ...partial
  } as AgentProfileDoc
}

describe('resolveMissionExecutor', () => {
  const reqBase = (): CreateMissionRequest => ({
    source: 'huly-ui',
    agentProfileId: 'a1',
    target: { type: 'project', projectId: 'p1' as any },
    userPrompt: 'x'
  })

  it('uses explicit executor when accessible', () => {
    const e1 = ex({ id: 'e1', type: 'codex-cli', visibility: 'shared' })
    const r = resolveMissionExecutor({
      workspaceId: WS,
      account: USER,
      role: AccountRole.User,
      profile: profile({ id: 'a1' }),
      req: { ...reqBase(), executorResourceId: 'e1', executorType: 'codex-cli' },
      allRaw: [e1],
      activeRuns: new Map()
    })
    expect(r.id).toBe('e1')
  })

  it('rejects explicit private executor for non-owner non-admin', () => {
    const e1 = ex({ id: 'e1', type: 'codex-cli', visibility: 'private', ownerId: OTHER as unknown as string })
    try {
      resolveMissionExecutor({
        workspaceId: WS,
        account: USER,
        role: AccountRole.User,
        profile: profile({ id: 'a1' }),
        req: { ...reqBase(), executorResourceId: 'e1' },
        allRaw: [e1],
        activeRuns: new Map()
      })
      expect(true).toBe(false)
    } catch (e) {
      expect((e as MissionError).code).toBe('EXECUTOR_UNAVAILABLE')
    }
  })

  it('allows explicit private executor for owner', () => {
    const e1 = ex({ id: 'e1', type: 'codex-cli', visibility: 'private', ownerId: USER as unknown as string })
    const r = resolveMissionExecutor({
      workspaceId: WS,
      account: USER,
      role: AccountRole.User,
      profile: profile({ id: 'a1' }),
      req: { ...reqBase(), executorResourceId: 'e1' },
      allRaw: [e1],
      activeRuns: new Map()
    })
    expect(r.id).toBe('e1')
  })

  it('uses profile default when no explicit id', () => {
    const def = ex({ id: 'def', type: 'cursor-cli', visibility: 'shared' })
    const r = resolveMissionExecutor({
      workspaceId: WS,
      account: USER,
      role: AccountRole.User,
      profile: profile({ id: 'a1', defaultExecutorId: 'def' }),
      req: reqBase(),
      allRaw: [def],
      activeRuns: new Map()
    })
    expect(r.id).toBe('def')
  })

  it('falls back to first shared matching executorType', () => {
    const s1 = ex({ id: 's1', type: 'codex-cli', visibility: 'shared' })
    const s2 = ex({ id: 's2', type: 'codex-cli', visibility: 'shared' })
    const r = resolveMissionExecutor({
      workspaceId: WS,
      account: USER,
      role: AccountRole.User,
      profile: profile({ id: 'a1' }),
      req: { ...reqBase(), executorType: 'codex-cli' },
      allRaw: [s1, s2],
      activeRuns: new Map()
    })
    expect(r.id).toBe('s1')
  })

  it('skips busy shared executors', () => {
    const s1 = ex({ id: 's1', type: 'codex-cli', visibility: 'shared', maxConcurrentRuns: 1 })
    const s2 = ex({ id: 's2', type: 'codex-cli', visibility: 'shared' })
    const runs = new Map<string, number>([['s1', 1]])
    const r = resolveMissionExecutor({
      workspaceId: WS,
      account: USER,
      role: AccountRole.User,
      profile: profile({ id: 'a1' }),
      req: { ...reqBase(), executorType: 'codex-cli' },
      allRaw: [s1, s2],
      activeRuns: runs
    })
    expect(r.id).toBe('s2')
  })

  it('throws when all shared busy', () => {
    const s1 = ex({ id: 's1', type: 'codex-cli', visibility: 'shared', maxConcurrentRuns: 1 })
    const runs = new Map<string, number>([['s1', 1]])
    try {
      resolveMissionExecutor({
        workspaceId: WS,
        account: USER,
        role: AccountRole.User,
        profile: profile({ id: 'a1' }),
        req: { ...reqBase(), executorType: 'codex-cli' },
        allRaw: [s1],
        activeRuns: runs
      })
      expect(true).toBe(false)
    } catch (e) {
      expect((e as MissionError).code).toBe('NO_SHARED_EXECUTOR')
    }
  })

  it('throws NO_EXECUTOR when no type and no default', () => {
    try {
      resolveMissionExecutor({
        workspaceId: WS,
        account: USER,
        role: AccountRole.User,
        profile: profile({ id: 'a1' }),
        req: reqBase(),
        allRaw: [],
        activeRuns: new Map()
      })
      expect(true).toBe(false)
    } catch (e) {
      expect((e as MissionError).code).toBe('NO_EXECUTOR')
    }
  })
})
