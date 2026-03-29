<!--
  Copyright © 2024 Hardcore Engineering Inc.
  SPDX-License-Identifier: EPL-2.0
-->
<script lang="ts">
  import type { ExecutorResourceRecord, ExecutorType, ExecutorVisibility } from '@hcengineering/ai-bot'
  import { Button, EditBox, Toggle } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'

  export let initial: Partial<ExecutorResourceRecord> | undefined = undefined

  const dispatch = createEventDispatcher()

  let name = initial?.name ?? ''
  let type: ExecutorType = initial?.type ?? 'codex-cli'
  let visibility: ExecutorVisibility = initial?.visibility ?? 'shared'
  let enabled = initial?.enabled ?? true
  let envRefStr = (initial?.envRef ?? []).join(', ')
  let maxConcurrentRuns = initial?.maxConcurrentRuns ?? 1

  function submit (): void {
    const envRef = envRefStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    dispatch('save', {
      name,
      type,
      visibility,
      enabled,
      envRef,
      maxConcurrentRuns
    })
  }
</script>

<div class="form">
  <div class="row">
    <EditBox bind:value={name} placeholder="Name" />
  </div>
  <div class="row">
    <span class="muted">Type</span>
    <select class="select" bind:value={type}>
      <option value="codex-cli">codex-cli</option>
      <option value="cursor-cli">cursor-cli</option>
    </select>
  </div>
  <div class="row">
    <span class="muted">Visibility</span>
    <select class="select" bind:value={visibility}>
      <option value="private">private</option>
      <option value="shared">shared</option>
    </select>
  </div>
  <div class="row">
    <Toggle bind:on={enabled} />
    <span class="ml-2">Enabled</span>
  </div>
  <div class="row">
    <span class="muted">Env refs (comma-separated names, e.g. MISSION_API_KEY)</span>
    <EditBox bind:value={envRefStr} placeholder="MISSION_FOO, AGENT_BAR" />
  </div>
  <div class="row">
    <span class="muted">Max concurrent runs</span>
    <input class="select" type="number" min="1" bind:value={maxConcurrentRuns} />
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
