<!--
  Copyright © 2024 Hardcore Engineering Inc.
  SPDX-License-Identifier: EPL-2.0
-->
<script lang="ts">
  import type { ExecutorType } from '@hcengineering/ai-bot'
  import { type Ref } from '@hcengineering/core'
  import { getClient } from '@hcengineering/presentation'
  import tracker, { type Issue, type Project } from '@hcengineering/tracker'
  import { Button, EditBox, Header, Label, Scroller } from '@hcengineering/ui'
  import { createEventDispatcher, onMount } from 'svelte'

  import aiBot from '../../plugin'
  import { createMission, listAgentProfiles, listExecutorResources } from '../../requests'

  /** Issue id when opened from issue action */
  export let taskId: Ref<Issue> | undefined = undefined
  /** Project id (issue space or project action) */
  export let projectId: Ref<Project> | undefined = undefined

  const dispatch = createEventDispatcher()
  let agentId = ''
  let executorId = ''
  let executorType: ExecutorType | '' = ''
  let scope: 'task' | 'project' | 'todo' | 'backlog' = 'task'
  let promptText = ''
  let loading = true
  let err = ''
  let result = ''

  let agents: { id: string; name: string; role: string }[] = []
  let executors: { id: string; name: string; type: ExecutorType }[] = []

  $: fromIssue = taskId !== undefined

  onMount(async () => {
    try {
      const client = getClient()
      if (taskId !== undefined) {
        const iss = await client.findOne(tracker.class.Issue, { _id: taskId })
        if (iss !== undefined) {
          projectId = iss.space
        }
      }
      const [a, e] = await Promise.all([listAgentProfiles(), listExecutorResources()])
      agents = a.map((x) => ({ id: x.id, name: x.name, role: x.role }))
      executors = e.map((x) => ({ id: x.id, name: x.name, type: x.type }))
      if (agents.length > 0) {
        agentId = agents[0].id
      }
      if (!fromIssue) {
        scope = 'project'
      }
    } catch (e: unknown) {
      err = e instanceof Error ? e.message : String(e)
    } finally {
      loading = false
    }
  })

  $: scopeOptions = fromIssue
    ? [
        { id: 'task', label: 'This task' },
        { id: 'project', label: 'All tasks in project' },
        { id: 'todo', label: 'Todo bucket' },
        { id: 'backlog', label: 'Backlog bucket' }
      ]
    : [
        { id: 'project', label: 'All tasks in project' },
        { id: 'todo', label: 'Todo bucket' },
        { id: 'backlog', label: 'Backlog bucket' }
      ]

  async function run (): Promise<void> {
    if (projectId === undefined) {
      err = 'Missing project'
      return
    }
    err = ''
    result = ''
    try {
      const target: {
        type: 'task' | 'project' | 'bucket'
        projectId: Ref<Project>
        taskId?: Ref<Issue>
        bucket?: 'todo' | 'backlog'
      } = {
        type: scope === 'task' ? 'task' : scope === 'project' ? 'project' : 'bucket',
        projectId: projectId as Ref<Project>
      }
      if (scope === 'task' && taskId !== undefined) {
        target.taskId = taskId
      }
      if (scope === 'todo' || scope === 'backlog') {
        target.bucket = scope
      }

      const m = await createMission({
        source: 'huly-ui',
        agentProfileId: agentId,
        executorResourceId: executorId === '' ? undefined : executorId,
        executorType: executorType === '' ? undefined : executorType,
        target,
        userPrompt: promptText
      })
      result =
        m.status === 'failed'
          ? `Failed: ${m.errorMessage ?? 'unknown'}`
          : `Done.\n\n${m.resultSummary ?? ''}\n\n${m.resultMarkdown ?? ''}`
      dispatch('close', m)
    } catch (e: unknown) {
      err = e instanceof Error ? e.message : String(e)
    }
  }
</script>

<div class="popup">
  <Header>
    <Label label={aiBot.string.RunAgentMission} />
  </Header>
  {#if loading}
    <div>Loading…</div>
  {:else}
    {#if err !== ''}
      <div class="error">{err}</div>
    {/if}
    <Scroller>
      <div class="field">
        <span class="muted">Agent</span>
        <select class="sel" bind:value={agentId}>
          {#each agents as a}
            <option value={a.id}>{a.name} ({a.role})</option>
          {/each}
        </select>
      </div>
      <div class="field">
        <span class="muted">Executor override (optional)</span>
        <select class="sel" bind:value={executorId}>
          <option value="">—</option>
          {#each executors as ex}
            <option value={ex.id}>{ex.name} ({ex.type})</option>
          {/each}
        </select>
      </div>
      <div class="field">
        <span class="muted">Executor type fallback (if no default)</span>
        <select class="sel" bind:value={executorType}>
          <option value="">—</option>
          <option value="codex-cli">codex-cli</option>
          <option value="cursor-cli">cursor-cli</option>
        </select>
      </div>
      <div class="field">
        <span class="muted">Scope</span>
        <select class="sel" bind:value={scope}>
          {#each scopeOptions as o}
            <option value={o.id}>{o.label}</option>
          {/each}
        </select>
      </div>
      <div class="field">
        <EditBox bind:value={promptText} placeholder="What should the agent analyze?" />
      </div>
      {#if result !== ''}
        <pre class="out">{result}</pre>
      {/if}
    </Scroller>
    <div class="actions">
      <Button label="Run" kind="primary" on:click={() => run()} />
      <Button label="Close" on:click={() => dispatch('close')} />
    </div>
  {/if}
</div>

<style lang="scss">
  .popup {
    min-width: 24rem;
    max-width: 40rem;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }
  .muted {
    font-size: 0.75rem;
    opacity: 0.7;
  }
  .sel {
    padding: 0.35rem;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .error {
    color: var(--theme-error-color);
    font-size: 0.875rem;
  }
  .out {
    white-space: pre-wrap;
    font-size: 0.8rem;
    max-height: 12rem;
    overflow: auto;
    background: var(--theme-bg-accent-color);
    padding: 0.5rem;
  }
</style>
