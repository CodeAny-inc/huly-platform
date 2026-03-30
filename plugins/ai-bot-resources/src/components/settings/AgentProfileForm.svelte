<!--
  Copyright © 2024 Hardcore Engineering Inc.
  SPDX-License-Identifier: EPL-2.0
-->
<script lang="ts">
  import type { AgentProfileRecord, AgentRole, ExecutorResourceRecord } from '@hcengineering/ai-bot'
  import { Button, EditBox, Toggle } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'

  export let executors: ExecutorResourceRecord[] = []
  export let initial: Partial<AgentProfileRecord> | undefined = undefined

  const dispatch = createEventDispatcher()

  let name = initial?.name ?? ''
  let role: AgentRole = initial?.role ?? 'CTO'
  let personaPrompt = initial?.personaPrompt ?? ''
  let defaultExecutorId = initial?.defaultExecutorId ?? ''
  let isActive = initial?.isActive ?? true

  function submit (): void {
    dispatch('save', {
      name,
      role,
      personaPrompt,
      defaultExecutorId: defaultExecutorId === '' ? undefined : defaultExecutorId,
      defaultMissionMode: 'analysis' as const,
      isActive
    })
  }
</script>

<div class="form">
  <div class="row">
    <EditBox bind:value={name} placeholder="Name" />
  </div>
  <div class="row">
    <span class="muted">Role</span>
    <select class="select" bind:value={role}>
      <option value="CEO">CEO</option>
      <option value="CTO">CTO</option>
      <option value="CMO">CMO</option>
      <option value="CUSTOM">CUSTOM</option>
    </select>
  </div>
  <div class="row">
    <EditBox bind:value={personaPrompt} placeholder="Persona prompt" />
  </div>
  <div class="row">
    <span class="muted">Default executor (optional)</span>
    <select class="select" bind:value={defaultExecutorId}>
      <option value="">—</option>
      {#each executors as ex}
        <option value={ex.id}>{ex.name} ({ex.type})</option>
      {/each}
    </select>
  </div>
  <div class="row">
    <Toggle bind:on={isActive} />
    <span class="ml-2">Active</span>
  </div>
  <div class="row actions">
    <Button label="Save" kind="primary" on:click={submit} />
    <Button label="Cancel" on:click={() => dispatch('cancel')} />
  </div>
</div>

<style lang="scss">
  .form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 22rem;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .actions {
    flex-direction: row;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .muted {
    font-size: 0.75rem;
    opacity: 0.7;
  }
  .ml-2 {
    margin-left: 0.5rem;
  }
  .select {
    padding: 0.35rem;
  }
</style>
