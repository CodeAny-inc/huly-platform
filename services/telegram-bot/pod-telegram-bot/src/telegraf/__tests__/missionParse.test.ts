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

  it('requires task for scope=task', () => {
    const r = parseMissionCommand('/mission agent=CTO scope=task project=P')
    expect('error' in r).toBe(true)
  })
})
