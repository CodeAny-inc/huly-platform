//
// Copyright © 2024 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//
import {
  type AgentProfileRecord,
  type ChannelStatusResponse,
  type CreateMissionRequest,
  type ExecutorResourceRecord,
  type ListMissionsResponse,
  type MissionRecord
} from '@hcengineering/ai-bot'
import { concatLink } from '@hcengineering/core'
import { getMetadata } from '@hcengineering/platform'
import presentation from '@hcengineering/presentation'

import aiBot from './plugin'

async function aiFetch<T> (path: string, init?: RequestInit): Promise<T> {
  const url = getMetadata(aiBot.metadata.EndpointURL) ?? ''
  const token = getMetadata(presentation.metadata.Token) ?? ''
  if (url === '' || token === '') {
    throw new Error('AI bot endpoint or token not configured')
  }
  const resp = await fetch(concatLink(url, path), {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? resp.statusText)
  }
  return (await resp.json()) as T
}

export async function listAgentProfiles (): Promise<AgentProfileRecord[]> {
  return await aiFetch('/agent-profiles')
}

export async function createAgentProfile (
  body: Omit<AgentProfileRecord, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'createdBy'>
): Promise<AgentProfileRecord> {
  return await aiFetch('/agent-profiles', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateAgentProfile (id: string, patch: Partial<AgentProfileRecord>): Promise<AgentProfileRecord> {
  return await aiFetch(`/agent-profiles/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) })
}

export async function deleteAgentProfile (id: string): Promise<void> {
  await aiFetch(`/agent-profiles/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function listExecutorResources (): Promise<ExecutorResourceRecord[]> {
  return await aiFetch('/executor-resources')
}

export async function createExecutorResource (
  body: Omit<ExecutorResourceRecord, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'activeRuns'>
): Promise<ExecutorResourceRecord> {
  return await aiFetch('/executor-resources', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateExecutorResource (
  id: string,
  patch: Partial<ExecutorResourceRecord>
): Promise<ExecutorResourceRecord> {
  return await aiFetch(`/executor-resources/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) })
}

export async function deleteExecutorResource (id: string): Promise<void> {
  await aiFetch(`/executor-resources/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function listMissions (): Promise<MissionRecord[]> {
  const r = await aiFetch<ListMissionsResponse>('/missions')
  return r.missions
}

export async function getMission (id: string): Promise<MissionRecord> {
  return await aiFetch(`/missions/${encodeURIComponent(id)}`)
}

export async function createMission (body: CreateMissionRequest): Promise<MissionRecord> {
  return await aiFetch('/missions', { method: 'POST', body: JSON.stringify(body) })
}

export async function getMissionChannelStatus (): Promise<ChannelStatusResponse> {
  return await aiFetch('/mission-channels/status')
}
