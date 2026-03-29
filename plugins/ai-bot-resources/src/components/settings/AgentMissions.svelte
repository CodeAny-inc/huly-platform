<!--
  Copyright © 2024 Hardcore Engineering Inc.
  SPDX-License-Identifier: EPL-2.0
-->
<script lang="ts">
  import type { AgentProfileRecord, ExecutorResourceRecord, MissionRecord } from '@hcengineering/ai-bot'
  import { Button, Header, Label, Scroller, showPopup } from '@hcengineering/ui'
  import { onMount } from 'svelte'

  import aiBot from '../../plugin'
  import {
    createAgentProfile,
    createExecutorResource,
    deleteAgentProfile,
    deleteExecutorResource,
    getMissionChannelStatus,
    listAgentProfiles,
    listExecutorResources,
    listMissions,
    updateAgentProfile,
    updateExecutorResource
  } from '../../requests'
  import AgentProfileForm from './AgentProfileForm.svelte'
  import ExecutorResourceForm from './ExecutorResourceForm.svelte'

  let agents: AgentProfileRecord[] = []
  let executors: ExecutorResourceRecord[] = []
  let missions: MissionRecord[] = []
  let telegram: 'connected' | 'not_connected' = 'not_connected'
  let loading = true
  let err = ''

  async function refresh (): Promise<void> {
    loading = true
    err = ''
    try {
      ;[agents, executors, missions] = await Promise.all([
        listAgentProfiles(),
        listExecutorResources(),
        listMissions()
      ])
      const ch = await getMissionChannelStatus()
      telegram = ch.telegram
    } catch (e: unknown) {
      err = e instanceof Error ? e.message : String(e)
    } finally {
      loading = false
    }
  }

  onMount(() => {
    void refresh()
  })

  function openAgentForm (a?: AgentProfileRecord): void {
    showPopup(
      AgentProfileForm,
      { executors, initial: a },
      undefined,
      async (result) => {
        if (result === undefined) return
        try {
          if (a !== undefined) {
            await updateAgentProfile(a.id, result as Partial<AgentProfileRecord>)
          } else {
            await createAgentProfile(result as any)
          }
          await refresh()
        } catch (e: unknown) {
          err = e instanceof Error ? e.message : String(e)
        }
      }
    )
  }

  function openExecutorForm (e?: ExecutorResourceRecord): void {
    showPopup(
      ExecutorResourceForm,
      { initial: e },
      undefined,
      async (result) => {
        if (result === undefined) return
        try {
          if (e !== undefined) {
            await updateExecutorResource(e.id, result as Partial<ExecutorResourceRecord>)
          } else {
            await createExecutorResource(result as any)
          }
          await refresh()
        } catch (err2: unknown) {
          err = err2 instanceof Error ? err2.message : String(err2)
        }
      }
    )
  }

  async function toggleAgent (a: AgentProfileRecord): Promise<void> {
    await updateAgentProfile(a.id, { isActive: !a.isActive })
    await refresh()
  }

  async function removeAgent (a: AgentProfileRecord): Promise<void> {
    await deleteAgentProfile(a.id)
    await refresh()
  }

  async function removeExecutor (e: ExecutorResourceRecord): Promise<void> {
    await deleteExecutorResource(e.id)
    await refresh()
  }
</script>

<div class="root">
  <Header>
    <Label label={aiBot.string.AgentMissions} />
  </Header>

  {#if err !== ''}
    <div class="error">{err}</div>
  {/if}

  {#if loading}
    <div>Loading…</div>
  {:else}
    <section>
      <div class="sectionHead">
        <Label label={aiBot.string.AgentProfiles} />
        <Button label="Add" size="small" on:click={() => openAgentForm()} />
      </div>
      <Scroller horizontal={false}>
        <table class="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Default executor</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {#each agents as a}
              <tr>
                <td>{a.name}</td>
                <td>{a.role}</td>
                <td>{a.defaultExecutorId ?? '—'}</td>
                <td>
                  <input type="checkbox" checked={a.isActive} on:change={() => toggleAgent(a)} />
                </td>
                <td class="nowrap">
                  <Button label="Edit" size="small" on:click={() => openAgentForm(a)} />
                  <Button label="Delete" size="small" on:click={() => removeAgent(a)} />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </Scroller>
    </section>

    <section>
      <div class="sectionHead">
        <Label label={aiBot.string.ExecutorResources} />
        <Button label="Add" size="small" on:click={() => openExecutorForm()} />
      </div>
      <Scroller horizontal={false}>
        <table class="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Visibility</th>
              <th>Busy</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {#each executors as e}
              <tr>
                <td>{e.name}</td>
                <td>{e.type}</td>
                <td>{e.visibility}</td>
                <td>{e.activeRuns ?? 0}/{e.maxConcurrentRuns}</td>
                <td class="nowrap">
                  <Button label="Edit" size="small" on:click={() => openExecutorForm(e)} />
                  <Button label="Delete" size="small" on:click={() => removeExecutor(e)} />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </Scroller>
    </section>

    <section>
      <Label label={aiBot.string.Channels} />
      <ul class="channels">
        <li>
          <Label label={telegram === 'connected' ? aiBot.string.TelegramConnected : aiBot.string.TelegramNotConnected} />
        </li>
        <li><Label label={aiBot.string.SlackPlanned} /></li>
        <li><Label label={aiBot.string.DiscordPlanned} /></li>
      </ul>
    </section>

    <section>
      <div class="sectionHead">
        <span>Recent missions</span>
        <Button label="Refresh" size="small" on:click={() => refresh()} />
      </div>
      <Scroller horizontal={false}>
        <table class="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {#each missions as m}
              <tr>
                <td class="mono">{m.id.slice(0, 8)}…</td>
                <td>{m.status}</td>
                <td>{m.resultSummary ?? m.errorMessage ?? '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </Scroller>
    </section>
  {/if}
</div>

<style lang="scss">
  .root {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .sectionHead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  .tbl {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  .tbl th,
  .tbl td {
    border-bottom: 1px solid var(--theme-divider-color);
    padding: 0.35rem 0.5rem;
    text-align: left;
  }
  .nowrap {
    white-space: nowrap;
  }
  .mono {
    font-family: monospace;
    font-size: 0.8rem;
  }
  .channels {
    margin: 0.5rem 0 0 1rem;
  }
  .error {
    color: var(--theme-error-color);
  }
</style>
