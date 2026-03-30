jest.mock('../../config', () => ({
  __esModule: true,
  default: {
    MissionCodexCommand: 'cat',
    MissionCursorCommand: 'cat',
    MissionExecutorTimeoutMs: 5000,
    MissionAllowedEnvPrefixes: 'MISSION_,AGENT_'
  }
}))

import { filterExecutorEnv } from '../executors'

describe('filterExecutorEnv', () => {
  it('keeps only envRef keys with allowed prefixes', () => {
    const env: NodeJS.ProcessEnv = {
      MISSION_API_KEY: 'secret',
      AGENT_TOKEN: 't',
      PATH: '/bin',
      HOME: '/home'
    }
    const out = filterExecutorEnv(['MISSION_API_KEY', 'AGENT_TOKEN', 'PATH'], env)
    expect(out.MISSION_API_KEY).toBe('secret')
    expect(out.AGENT_TOKEN).toBe('t')
    expect(out.PATH).toBeUndefined()
    expect(out.HOME).toBeUndefined()
  })

  it('drops envRef names that do not match prefix', () => {
    const env: NodeJS.ProcessEnv = { SECRET_KEY: 'x', MISSION_X: 'y' }
    const out = filterExecutorEnv(['SECRET_KEY', 'MISSION_X'], env)
    expect(out.SECRET_KEY).toBeUndefined()
    expect(out.MISSION_X).toBe('y')
  })
})
