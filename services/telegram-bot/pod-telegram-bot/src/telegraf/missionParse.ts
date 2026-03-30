export interface ParsedMissionCommand {
  agent: string
  scope: 'task' | 'project' | 'todo' | 'backlog'
  project: string
  workspace?: string
  task?: string
  userPrompt: string
}

export function parseMissionCommand (text: string): ParsedMissionCommand | { error: string } {
  const trimmed = text.replace(/^\/mission\s*/i, '').trim()
  if (trimmed.length === 0) {
    return { error: 'Usage: /mission agent=CTO scope=todo project=Platform Your prompt here' }
  }

  const re = /(\w+)=(\S+)/g
  let m: RegExpExecArray | null
  let lastIndex = 0
  while ((m = re.exec(trimmed)) !== null) {
    lastIndex = m.index + m[0].length
  }
  const after = trimmed.slice(lastIndex).trim()

  const map: Record<string, string> = {}
  for (const t of trimmed.matchAll(/(\w+)=(\S+)/g)) {
    map[t[1]] = t[2]
  }

  const agent = map.agent
  const scopeRaw = map.scope?.toLowerCase()
  const project = map.project
  const workspace = map.workspace
  const task = map.task

  if (agent === undefined || scopeRaw === undefined || project === undefined) {
    return {
      error: 'Missing required keys. Need agent=, scope=, and project= (optional: workspace=, task= for scope=task)'
    }
  }

  if (!['task', 'project', 'todo', 'backlog'].includes(scopeRaw)) {
    return { error: 'scope must be task, project, todo, or backlog' }
  }

  if (scopeRaw === 'task' && (task === undefined || task.length === 0)) {
    return { error: 'For scope=task, include task=<issueId or identifier>' }
  }

  return {
    agent,
    scope: scopeRaw as ParsedMissionCommand['scope'],
    project,
    workspace,
    task,
    userPrompt: after
  }
}
