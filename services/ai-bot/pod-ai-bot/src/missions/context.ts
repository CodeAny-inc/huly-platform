import { getName } from '@hcengineering/contact'
import contact, { type Contact } from '@hcengineering/contact'
import core, { type Ref, type Status, SortingOrder, type TxOperations, type WorkspaceIds } from '@hcengineering/core'
import task, { type ProjectType } from '@hcengineering/task'
import tracker, { Issue, IssuePriority, IssueStatus, type Project } from '@hcengineering/tracker'
import config from '../config'
import { missionError } from './types'

export interface MissionTaskLine {
  title: string
  status: string
  assignee?: string
  priority?: string
  description: string
}

export interface MissionContextPayload {
  workspaceName: string
  projectTitle: string
  tasks: MissionTaskLine[]
  /** First task in context — used to attach mission chat when scope is project/bucket. */
  postToTaskId?: Ref<Issue>
}

const MAX_TASKS = () => config.MissionContextMaxTasks
const DESC_MAX = () => config.MissionContextDescMaxChars

function truncate (s: string): string {
  const t = s.trim()
  if (t.length <= DESC_MAX()) return t
  return t.slice(0, DESC_MAX()) + '…'
}

async function descriptionToPlain (_client: TxOperations, issue: Issue): Promise<string> {
  // Collaborative markup blobs require collaborator fetch; MVP omits description text when not trivially available.
  if (issue.description == null) return ''
  return '(description stored as collaborative doc — open task in Huly for full text)'
}

async function resolveAssigneeName (client: TxOperations, assignee: Ref<Contact> | null): Promise<string | undefined> {
  if (assignee == null) return undefined
  const c = await client.findOne(contact.class.Contact, { _id: assignee })
  if (c === undefined) return undefined
  return getName(client.getHierarchy(), c)
}

async function issueToLine (client: TxOperations, issue: Issue, statusById: Map<Ref<IssueStatus>, IssueStatus>): Promise<MissionTaskLine> {
  const st = statusById.get(issue.status)
  const priority = IssuePriorityLabels[issue.priority] ?? String(issue.priority)
  return {
    title: issue.title,
    status: st?.name ?? 'unknown',
    assignee: await resolveAssigneeName(client, issue.assignee),
    priority,
    description: await descriptionToPlain(client, issue)
  }
}

const IssuePriorityLabels: Record<IssuePriority, string> = {
  [IssuePriority.NoPriority]: 'No priority',
  [IssuePriority.Urgent]: 'Urgent',
  [IssuePriority.High]: 'High',
  [IssuePriority.Medium]: 'Medium',
  [IssuePriority.Low]: 'Low'
}

export async function buildMissionContext (
  client: TxOperations,
  wsIds: WorkspaceIds,
  params: {
    targetType: 'task' | 'project' | 'bucket'
    projectId: Ref<Project>
    taskId?: Ref<Issue>
    bucket?: 'todo' | 'backlog'
  }
): Promise<MissionContextPayload> {
  const workspaceName = wsIds.url

  const project = await client.findOne(tracker.class.Project, { _id: params.projectId })
  if (project === undefined) {
    throw missionError('Project not found', 'NOT_FOUND')
  }

  const projectType = await client.findOne<ProjectType>(task.class.ProjectType, { _id: project.type })
  if (projectType === undefined) {
    throw missionError('Project type not found', 'NOT_FOUND')
  }

  if (params.targetType === 'bucket' && !projectType.classic) {
    throw missionError(
      'Bucket scope (todo/backlog) requires a classic tracker project type with standard statuses.',
      'BUCKET_NOT_CLASSIC'
    )
  }

  const statusIds = projectType.statuses.map((s) => s._id)
  const statuses = await client.findAll<Status>(task.class.Status, { _id: { $in: statusIds } })
  const statusById = new Map(statuses.map((s) => [s._id as Ref<IssueStatus>, s as IssueStatus]))

  const todoCat = task.statusCategory.ToDo
  const backlogCat = task.statusCategory.UnStarted

  const todoStatuses = new Set(
    statuses.filter((s) => s.category !== undefined && s.category === todoCat).map((s) => s._id as Ref<IssueStatus>)
  )
  const backlogStatuses = new Set(
    statuses
      .filter((s) => s.category !== undefined && s.category === backlogCat)
      .map((s) => s._id as Ref<IssueStatus>)
  )

  if (params.targetType === 'bucket') {
    if (params.bucket === 'todo' && todoStatuses.size === 0) {
      throw missionError('This project has no Todo status category; cannot use scope=todo.', 'BUCKET_NO_TODO')
    }
    if (params.bucket === 'backlog' && backlogStatuses.size === 0) {
      throw missionError('This project has no Backlog status category; cannot use scope=backlog.', 'BUCKET_NO_BACKLOG')
    }
  }

  let issues: Issue[] = []

  if (params.targetType === 'task') {
    if (params.taskId === undefined) {
      throw missionError('taskId is required for task scope', 'INVALID_TARGET')
    }
    const issue = await client.findOne(tracker.class.Issue, { _id: params.taskId, space: params.projectId })
    if (issue === undefined) {
      throw missionError('Task not found in project', 'NOT_FOUND')
    }
    issues = [issue]
  } else if (params.targetType === 'project') {
    issues = await client.findAll(
      tracker.class.Issue,
      { space: params.projectId, attachedTo: tracker.ids.NoParent },
      { sort: { modifiedOn: SortingOrder.Descending }, limit: MAX_TASKS() }
    )
  } else {
    const bucketFilter =
      params.bucket === 'todo'
        ? { status: { $in: Array.from(todoStatuses) } as unknown as Ref<IssueStatus> }
        : { status: { $in: Array.from(backlogStatuses) } as unknown as Ref<IssueStatus> }

    issues = await client.findAll(
      tracker.class.Issue,
      { space: params.projectId, attachedTo: tracker.ids.NoParent, ...bucketFilter },
      { sort: { modifiedOn: SortingOrder.Descending }, limit: MAX_TASKS() }
    )
  }

  const lines: MissionTaskLine[] = []
  for (const issue of issues) {
    lines.push(await issueToLine(client, issue, statusById as Map<Ref<IssueStatus>, IssueStatus>))
  }

  const postToTaskId =
    params.targetType === 'task' ? params.taskId : issues.length > 0 ? issues[0]._id : undefined

  return {
    workspaceName,
    projectTitle: project.name,
    tasks: lines,
    postToTaskId
  }
}

export function formatContextForPrompt (ctx: MissionContextPayload): string {
  const lines = [
    `Workspace: ${ctx.workspaceName}`,
    `Project: ${ctx.projectTitle}`,
    '',
    'Tasks (read-only, capped):',
    ...ctx.tasks.map((t, i) => {
      const parts = [
        `${i + 1}. ${t.title}`,
        `   Status: ${t.status}`,
        t.assignee !== undefined ? `   Assignee: ${t.assignee}` : undefined,
        t.priority !== undefined ? `   Priority: ${t.priority}` : undefined,
        t.description.length > 0 ? `   Description: ${t.description}` : undefined
      ].filter((x) => x !== undefined)
      return parts.join('\n')
    })
  ]
  return lines.join('\n')
}
