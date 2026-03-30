import { parseMissionCommand } from '../missionParse'

describe('parseMissionCommand', () => {
  it('parses basic keys', () => {
    const r = parseMissionCommand('/mission agent=CTO scope=todo project=Plat Analyze')
    expect('error' in r).toBe(false)
    if (!('error' in r)) {
      expect(r.agent).toBe('CTO')
      expect(r.scope).toBe('todo')
      expect(r.project).toBe('Plat')
      expect(r.userPrompt).toBe('Analyze')
    }
  })

  it('parses workspace key', () => {
    const r = parseMissionCommand(
      '/mission agent=CTO scope=project project=Plat workspace=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa Do it'
    )
    expect('error' in r).toBe(false)
    if (!('error' in r)) {
      expect(r.workspace).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      expect(r.scope).toBe('project')
      expect(r.userPrompt).toBe('Do it')
    }
  })

  it('parses task key for scope=task', () => {
    const r = parseMissionCommand('/mission agent=CTO scope=task project=Plat task=TSK-1 Review')
    expect('error' in r).toBe(false)
    if (!('error' in r)) {
      expect(r.scope).toBe('task')
      expect(r.task).toBe('TSK-1')
      expect(r.userPrompt).toBe('Review')
    }
  })

  it('rejects invalid scope', () => {
    const r = parseMissionCommand('/mission agent=CTO scope=invalid project=P')
    expect('error' in r).toBe(true)
  })

  it('requires task for scope=task', () => {
    const r = parseMissionCommand('/mission agent=CTO scope=task project=P')
    expect('error' in r).toBe(true)
  })
})
