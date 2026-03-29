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
import { Token } from '@hcengineering/server-token'
import cors from 'cors'
import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import { type Server } from 'http'
import {
  TranslateRequest,
  ConnectMeetingRequest,
  DisconnectMeetingRequest,
  AIEventRequest,
  PostTranscriptRequest,
  SummarizeMessagesRequest,
  type AgentProfileRecord,
  type CreateMissionRequest,
  type ExecutorResourceRecord
} from '@hcengineering/ai-bot'
import { extractToken, getAccountClient, readToken } from '@hcengineering/server-client'
import { isWorkspaceLoginInfo } from '@hcengineering/account-client'
import { MeasureContext } from '@hcengineering/core'

import { ApiError } from './error'
import { AIControl } from '../controller'
import { type MissionError } from '../missions/types'

type AsyncRequestHandler = (req: Request, res: Response, token: Token, next: NextFunction) => Promise<void>

async function getWorkspaceRoleFromRequest (headers: Request['headers']): Promise<import('@hcengineering/core').AccountRole> {
  const raw = readToken(headers)
  if (raw === undefined) {
    throw new ApiError(401)
  }
  const info = await getAccountClient(raw).getLoginInfoByToken()
  if (!isWorkspaceLoginInfo(info)) {
    throw new ApiError(401)
  }
  return info.role
}

function handleMissionErr (err: unknown, res: Response): boolean {
  if (err !== null && typeof err === 'object' && 'code' in err && err instanceof Error) {
    const m = err as MissionError
    res.status(400).json({ code: m.code, message: m.message })
    return true
  }
  return false
}

const handleRequest = async (
  fn: AsyncRequestHandler,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractToken(req.headers)
  if (token === undefined) {
    throw new ApiError(401)
  }
  try {
    await fn(req, res, token, next)
  } catch (err: unknown) {
    next(err)
  }
}

const wrapRequest = (fn: AsyncRequestHandler) => (req: Request, res: Response, next: NextFunction) => {
  void handleRequest(fn, req, res, next)
}

export function createServer (controller: AIControl, ctx: MeasureContext): Express {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.post(
    '/translate',
    wrapRequest(async (req, res, token) => {
      if (req.body == null || Array.isArray(req.body) || typeof req.body !== 'object') {
        throw new ApiError(400)
      }
      const response = await controller.translate(token.workspace, req.body as TranslateRequest)
      if (response === undefined) {
        throw new ApiError(500)
      }

      res.status(200)
      res.json(response)
    })
  )

  app.post(
    '/summarize',
    wrapRequest(async (req, res, token) => {
      if (req.body == null || Array.isArray(req.body) || typeof req.body !== 'object') {
        throw new ApiError(400)
      }

      const response = await controller.summarizeMessages(token.workspace, req.body as SummarizeMessagesRequest)
      if (response === undefined) {
        throw new ApiError(500)
      }

      res.status(200)
      res.json(response)
    })
  )

  app.post(
    '/connect',
    wrapRequest(async (_, res, token) => {
      ctx.info('Request to connect to workspace', { workspace: token.workspace })
      await controller.connect(token.workspace)

      res.status(200)
      res.json({})
    })
  )

  app.post(
    '/events',
    wrapRequest(async (req, res, token) => {
      if (req.body == null) {
        throw new ApiError(400)
      }

      const events = Array.isArray(req.body) ? req.body : [req.body]

      await controller.processEvent(token.workspace, events as AIEventRequest[])
    })
  )

  app.post(
    '/love/transcript',
    wrapRequest(async (req, res, token) => {
      if (req.body == null || Array.isArray(req.body) || typeof req.body !== 'object') {
        throw new ApiError(400)
      }

      if (token.account !== controller.personUuid) {
        throw new ApiError(401)
      }

      await controller.processLoveTranscript(req.body as PostTranscriptRequest)

      res.status(200)
      res.json({})
    })
  )

  app.post(
    '/love/connect',
    wrapRequest(async (req, res, token) => {
      if (req.body == null || Array.isArray(req.body) || typeof req.body !== 'object') {
        throw new ApiError(400)
      }

      const request: ConnectMeetingRequest = req.body
      await controller.loveConnect(token.workspace, request)

      res.status(200)
      res.json({})
    })
  )

  app.post(
    '/love/disconnect',
    wrapRequest(async (req, res, token) => {
      if (req.body == null || Array.isArray(req.body) || typeof req.body !== 'object') {
        throw new ApiError(400)
      }

      const request: DisconnectMeetingRequest = req.body
      await controller.loveDisconnect(token.workspace, request)

      res.status(200)
      res.json({})
    })
  )

  app.get(
    '/agent-profiles',
    wrapRequest(async (_req, res, token) => {
      const list = await controller.listAgentProfiles(token.workspace)
      res.status(200).json(list)
    })
  )

  app.post(
    '/agent-profiles',
    wrapRequest(async (req, res, token) => {
      try {
        if (req.body == null || typeof req.body !== 'object') throw new ApiError(400)
        const created = await controller.createAgentProfile(token.workspace, token.account, req.body as Omit<
        AgentProfileRecord,
        'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'createdBy'
        >)
        res.status(200).json(created)
      } catch (err: unknown) {
        if (handleMissionErr(err, res)) return
        throw err
      }
    })
  )

  app.put(
    '/agent-profiles/:id',
    wrapRequest(async (req, res, token) => {
      try {
        const id = req.params.id
        const updated = await controller.updateAgentProfile(token.workspace, id, req.body as Partial<AgentProfileRecord>)
        if (updated === undefined) throw new ApiError(404)
        res.status(200).json(updated)
      } catch (err: unknown) {
        if (handleMissionErr(err, res)) return
        throw err
      }
    })
  )

  app.delete(
    '/agent-profiles/:id',
    wrapRequest(async (req, res, token) => {
      const ok = await controller.deleteAgentProfile(token.workspace, req.params.id)
      if (!ok) throw new ApiError(404)
      res.status(200).json({ ok: true })
    })
  )

  app.get(
    '/executor-resources',
    wrapRequest(async (_req, res, token) => {
      const role = await getWorkspaceRoleFromRequest(_req.headers)
      const list = await controller.listExecutorResources(token.workspace, token.account, role)
      res.status(200).json(list)
    })
  )

  app.post(
    '/executor-resources',
    wrapRequest(async (req, res, token) => {
      try {
        if (req.body == null || typeof req.body !== 'object') throw new ApiError(400)
        const role = await getWorkspaceRoleFromRequest(req.headers)
        const body = req.body as Omit<
        ExecutorResourceRecord,
        'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'activeRuns'
        >
        const created = await controller.createExecutorResource(token.workspace, token.account, body)
        res.status(200).json(created)
      } catch (err: unknown) {
        if (handleMissionErr(err, res)) return
        throw err
      }
    })
  )

  app.put(
    '/executor-resources/:id',
    wrapRequest(async (req, res, token) => {
      try {
        const role = await getWorkspaceRoleFromRequest(req.headers)
        const updated = await controller.updateExecutorResource(
          token.workspace,
          req.params.id,
          token.account,
          role,
          req.body as Partial<ExecutorResourceRecord>
        )
        if (updated === undefined) throw new ApiError(404)
        res.status(200).json(updated)
      } catch (err: unknown) {
        if (handleMissionErr(err, res)) return
        throw err
      }
    })
  )

  app.delete(
    '/executor-resources/:id',
    wrapRequest(async (req, res, token) => {
      try {
        const role = await getWorkspaceRoleFromRequest(req.headers)
        const ok = await controller.deleteExecutorResource(token.workspace, req.params.id, token.account, role)
        if (!ok) throw new ApiError(404)
        res.status(200).json({ ok: true })
      } catch (err: unknown) {
        if (handleMissionErr(err, res)) return
        throw err
      }
    })
  )

  app.post(
    '/missions',
    wrapRequest(async (req, res, token) => {
      try {
        if (req.body == null || typeof req.body !== 'object') throw new ApiError(400)
        const raw = readToken(req.headers)
        if (raw === undefined) throw new ApiError(401)
        const result = await controller.createMission(
          token.workspace,
          token.account,
          raw,
          req.body as CreateMissionRequest
        )
        res.status(200).json(result)
      } catch (err: unknown) {
        if (handleMissionErr(err, res)) return
        throw err
      }
    })
  )

  app.get(
    '/missions',
    wrapRequest(async (_req, res, token) => {
      const list = await controller.listMissions(token.workspace)
      res.status(200).json({ missions: list })
    })
  )

  app.get(
    '/missions/:id',
    wrapRequest(async (req, res, token) => {
      const m = await controller.getMission(token.workspace, req.params.id)
      if (m === undefined) throw new ApiError(404)
      res.status(200).json(m)
    })
  )

  app.get(
    '/mission-channels/status',
    wrapRequest(async (_req, res, token) => {
      const s = await controller.getMissionChannels(token.workspace)
      res.status(200).json(s)
    })
  )

  app.get(
    '/love/:roomName/identity',
    wrapRequest(async (req, res, token) => {
      if (token.account !== controller.personUuid) {
        throw new ApiError(401)
      }

      const roomName = req.params.roomName
      const resp = await controller.getLoveIdentity(roomName)

      if (resp === undefined) {
        throw new ApiError(404)
      }

      res.status(200)
      res.json(resp)
    })
  )

  app.use((err: any, _req: any, res: any, _next: any) => {
    console.log(err)
    if (err instanceof ApiError) {
      res.status(err.code).send({ code: err.code, message: err.message })
      return
    }

    res.status(500).send(err.message?.length > 0 ? { message: err.message } : err)
  })

  return app
}

export function listen (e: Express, port: number, host?: string): Server {
  const cb = (): void => {
    console.log(`AI service has been started at ${host ?? '*'}:${port}`)
  }

  return host !== undefined ? e.listen(port, host, cb) : e.listen(port, cb)
}
