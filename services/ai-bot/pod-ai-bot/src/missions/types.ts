import type {
  AgentProfileRecord,
  CreateMissionRequest,
  ExecutorResourceRecord,
  MissionRecord
} from '@hcengineering/ai-bot'

export type { AgentProfileRecord, CreateMissionRequest, ExecutorResourceRecord, MissionRecord }

export interface MissionError extends Error {
  code: string
}

export function missionError (message: string, code: string = 'MISSION_ERROR'): MissionError {
  const e = new Error(message) as MissionError
  e.code = code
  return e
}
