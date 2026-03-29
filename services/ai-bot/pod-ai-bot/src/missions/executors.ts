import { spawn } from 'child_process'

import type { ExecutorType } from '@hcengineering/ai-bot'

import config from '../config'

export async function runAllowlistedExecutor (params: {
  type: ExecutorType
  promptStdin: string
  env: NodeJS.ProcessEnv
}): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const cmd = params.type === 'codex-cli' ? config.MissionCodexCommand : config.MissionCursorCommand
  const argv = [cmd]

  return await new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), {
      shell: false,
      env: params.env,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`Executor timed out after ${config.MissionExecutorTimeoutMs}ms`))
    }, config.MissionExecutorTimeoutMs)

    child.stdout?.on('data', (d: Buffer) => {
      out += d.toString('utf8')
    })
    child.stderr?.on('data', (d: Buffer) => {
      err += d.toString('utf8')
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout: out, stderr: err, exitCode: code })
    })

    child.stdin?.write(params.promptStdin, 'utf8')
    child.stdin?.end()
  })
}

export function filterExecutorEnv (envRef: string[], processEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const prefixes = config.MissionAllowedEnvPrefixes.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
  const allowedNames = new Set(envRef.filter((name) => prefixes.some((p) => name.startsWith(p))))
  const result: NodeJS.ProcessEnv = { ...processEnv }
  for (const key of Object.keys(result)) {
    if (!allowedNames.has(key)) {
      delete result[key]
    }
  }
  return result
}
