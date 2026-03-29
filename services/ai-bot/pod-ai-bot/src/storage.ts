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

import { MongoClientReference, getMongoClient } from '@hcengineering/mongo'
import { Collection, Db, MongoClient, ObjectId, UpdateFilter, WithId } from 'mongodb'
import { Doc, Ref, SortingOrder, WorkspaceUuid } from '@hcengineering/core'
import { WorkspaceInfoRecord } from '@hcengineering/server-ai-bot'

import config from './config'
import { AgentProfileDoc, ExecutorResourceDoc, HistoryRecord, MissionDoc } from './types'

const clientRef: MongoClientReference = getMongoClient(config.MongoURL)
let client: MongoClient | undefined

const connectDB = (() => {
  return async () => {
    if (client === undefined) {
      client = await clientRef.getClient()
    }

    return client.db(config.ConfigurationDB)
  }
})()

export async function getDbStorage (): Promise<DbStorage> {
  const db = await connectDB()
  return new DbStorage(db)
}

export class DbStorage {
  private readonly workspacesInfoCollection: Collection<WorkspaceInfoRecord>
  private readonly historyCollection: Collection<HistoryRecord>
  private readonly agentProfilesCollection: Collection<AgentProfileDoc>
  private readonly executorResourcesCollection: Collection<ExecutorResourceDoc>
  private readonly missionsCollection: Collection<MissionDoc>

  constructor (private readonly db: Db) {
    this.workspacesInfoCollection = this.db.collection<WorkspaceInfoRecord>('workspacesInfo')
    this.historyCollection = this.db.collection<HistoryRecord>('history')
    this.agentProfilesCollection = this.db.collection<AgentProfileDoc>('agentProfiles')
    this.executorResourcesCollection = this.db.collection<ExecutorResourceDoc>('executorResources')
    this.missionsCollection = this.db.collection<MissionDoc>('missions')
    void this.agentProfilesCollection.createIndex({ workspaceId: 1, id: 1 }, { unique: true })
    void this.executorResourcesCollection.createIndex({ workspaceId: 1, id: 1 }, { unique: true })
    void this.missionsCollection.createIndex({ workspaceId: 1, id: 1 }, { unique: true })
  }

  async addHistoryRecord (record: HistoryRecord): Promise<ObjectId> {
    return (await this.historyCollection.insertOne(record)).insertedId
  }

  async getHistoryRecords (workspace: WorkspaceUuid, objectId: Ref<Doc>): Promise<WithId<HistoryRecord>[]> {
    return await this.historyCollection
      .find({ workspace, objectId }, { sort: { timestamp: SortingOrder.Ascending } })
      .toArray()
  }

  async removeHistoryRecords (_ids: ObjectId[]): Promise<void> {
    await this.historyCollection.deleteMany({ _id: { $in: _ids } })
  }

  async getWorkspace (workspace: string): Promise<WorkspaceInfoRecord | undefined> {
    return (await this.workspacesInfoCollection.findOne({ workspace })) ?? undefined
  }

  async addWorkspace (record: WorkspaceInfoRecord): Promise<void> {
    await this.workspacesInfoCollection.insertOne(record)
  }

  async updateWorkspace (workspace: string, update: UpdateFilter<WorkspaceInfoRecord>): Promise<void> {
    await this.workspacesInfoCollection.updateOne({ workspace }, update)
  }

  async listAgentProfiles (workspaceId: WorkspaceUuid): Promise<AgentProfileDoc[]> {
    return await this.agentProfilesCollection.find({ workspaceId }).sort({ createdAt: SortingOrder.Descending }).toArray()
  }

  async getAgentProfile (workspaceId: WorkspaceUuid, id: string): Promise<AgentProfileDoc | undefined> {
    return (await this.agentProfilesCollection.findOne({ workspaceId, id })) ?? undefined
  }

  async insertAgentProfile (doc: AgentProfileDoc): Promise<void> {
    await this.agentProfilesCollection.insertOne(doc)
  }

  async updateAgentProfile (workspaceId: WorkspaceUuid, id: string, update: Partial<AgentProfileDoc>): Promise<void> {
    await this.agentProfilesCollection.updateOne({ workspaceId, id }, { $set: { ...update, updatedAt: Date.now() } })
  }

  async deleteAgentProfile (workspaceId: WorkspaceUuid, id: string): Promise<void> {
    await this.agentProfilesCollection.deleteOne({ workspaceId, id })
  }

  async listExecutorResources (workspaceId: WorkspaceUuid): Promise<ExecutorResourceDoc[]> {
    return await this.executorResourcesCollection
      .find({ workspaceId })
      .sort({ createdAt: SortingOrder.Ascending })
      .toArray()
  }

  async getExecutorResource (workspaceId: WorkspaceUuid, id: string): Promise<ExecutorResourceDoc | undefined> {
    return (await this.executorResourcesCollection.findOne({ workspaceId, id })) ?? undefined
  }

  async insertExecutorResource (doc: ExecutorResourceDoc): Promise<void> {
    await this.executorResourcesCollection.insertOne(doc)
  }

  async updateExecutorResource (
    workspaceId: WorkspaceUuid,
    id: string,
    update: Partial<ExecutorResourceDoc>
  ): Promise<void> {
    await this.executorResourcesCollection.updateOne({ workspaceId, id }, { $set: { ...update, updatedAt: Date.now() } })
  }

  async deleteExecutorResource (workspaceId: WorkspaceUuid, id: string): Promise<void> {
    await this.executorResourcesCollection.deleteOne({ workspaceId, id })
  }

  async listMissions (workspaceId: WorkspaceUuid, limit: number = 50): Promise<MissionDoc[]> {
    return await this.missionsCollection
      .find({ workspaceId })
      .sort({ createdAt: SortingOrder.Descending })
      .limit(limit)
      .toArray()
  }

  async getMission (workspaceId: WorkspaceUuid, id: string): Promise<MissionDoc | undefined> {
    return (await this.missionsCollection.findOne({ workspaceId, id })) ?? undefined
  }

  async insertMission (doc: MissionDoc): Promise<void> {
    await this.missionsCollection.insertOne(doc)
  }

  async updateMission (workspaceId: WorkspaceUuid, id: string, update: Partial<MissionDoc>): Promise<void> {
    await this.missionsCollection.updateOne({ workspaceId, id }, { $set: { ...update, updatedAt: Date.now() } })
  }

  close (): void {
    clientRef.close()
  }
}
