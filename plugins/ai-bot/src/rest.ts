//
// Copyright © 2024-2025 Hardcore Engineering Inc.
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

import { Class, Doc, Markup, PersonId, Ref, Space, Timestamp } from '@hcengineering/core'
import { Room, RoomLanguage } from '@hcengineering/love'
import { Contact, Person } from '@hcengineering/contact'
import { ChatMessage } from '@hcengineering/chunter'

export interface AIEventRequest {
  message: string
  messageClass: Ref<Class<ChatMessage>>
  messageId: Ref<ChatMessage>
  objectClass: Ref<Class<Doc>>
  objectId: Ref<Doc>
  objectSpace: Ref<Space>
  user: PersonId
  collection: string
  createdOn: Timestamp
}

export interface TranslateRequest {
  text: Markup
  lang: string
}

export interface PersonMessage {
  personRef: Ref<Contact>
  personName: string

  time: Timestamp
  text: string
}

export interface SummarizeMessagesRequest {
  lang: string

  target: Ref<Doc>
  targetClass: Ref<Class<Doc>>
}

export interface SummarizeMessagesResponse {
  text: Markup
  lang: string
}

export interface TranslateResponse {
  text: Markup
  lang: string
}

export interface ConnectMeetingRequest {
  roomId: Ref<Room>
  language: RoomLanguage
  transcription: boolean
}

export interface DisconnectMeetingRequest {
  roomId: Ref<Room>
}

export interface PostTranscriptRequest {
  transcript: string
  participant: Ref<Person>
  roomName: string
}

export interface IdentityResponse {
  identity: Ref<Person>
  name: string
}

/** Agent Missions MVP — shared REST DTOs (pod-ai-bot + client). */

export type AgentRole = 'CEO' | 'CTO' | 'CMO' | 'CUSTOM'

export type ExecutorType = 'codex-cli' | 'cursor-cli'

export type ExecutorVisibility = 'private' | 'shared'

export type MissionSource = 'huly-ui' | 'telegram'

export type MissionStatus = 'queued' | 'running' | 'completed' | 'failed'

export type MissionTargetType = 'task' | 'project' | 'bucket'

export type MissionBucket = 'todo' | 'backlog'

export interface MissionTargetDTO {
  type: MissionTargetType
  projectId?: Ref<Doc>
  taskId?: Ref<Doc>
  bucket?: MissionBucket
}

export interface AgentProfileRecord {
  id: string
  workspaceId: string
  name: string
  role: AgentRole
  personaPrompt: string
  defaultExecutorId?: string
  defaultMissionMode: 'analysis'
  isActive: boolean
  createdBy: string
  createdAt: number
  updatedAt: number
}

export interface ExecutorResourceRecord {
  id: string
  workspaceId: string
  type: ExecutorType
  name: string
  visibility: ExecutorVisibility
  ownerId: string
  enabled: boolean
  /** Server-only mapped command id; never user-controlled. */
  mappedCommandId: ExecutorType
  envRef: string[]
  maxConcurrentRuns: number
  activeRuns?: number
  createdAt: number
  updatedAt: number
}

export interface MissionRecord {
  id: string
  workspaceId: string
  source: MissionSource
  sourceRef?: string
  requestedBy: string
  agentProfileId: string
  executorResourceId: string
  target: MissionTargetDTO
  userPrompt: string
  status: MissionStatus
  resultSummary?: string
  resultMarkdown?: string
  errorMessage?: string
  createdAt: number
  updatedAt: number
}

export interface CreateMissionRequest {
  source: MissionSource
  sourceRef?: string
  agentProfileId: string
  executorResourceId?: string
  /** Required for shared fallback when profile has no default executor. */
  executorType?: ExecutorType
  target: MissionTargetDTO
  userPrompt: string
}

export interface ListMissionsResponse {
  missions: MissionRecord[]
}

export interface ChannelStatusResponse {
  telegram: 'connected' | 'not_connected'
  slack: 'planned'
  discord: 'planned'
}
