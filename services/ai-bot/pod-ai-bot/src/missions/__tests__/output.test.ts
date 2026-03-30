import { normalizeMissionMarkdown } from '../output'

describe('normalizeMissionMarkdown', () => {
  it('wraps unstructured output', () => {
    const { markdown, summary } = normalizeMissionMarkdown('hello world', 10000)
    expect(markdown).toContain('# Mission Result')
    expect(markdown).toContain('## Summary')
    expect(summary.length).toBeGreaterThan(0)
  })

  it('preserves structured output', () => {
    const md = `# Mission Result\n## Summary\nok\n## Findings\n- a\n## Risks / Blockers\n- r\n## Recommended Next Actions\n1. x\n## Confidence\nHigh`
    const { markdown, summary } = normalizeMissionMarkdown(md, 10000)
    expect(markdown).toContain('## Summary')
    expect(summary).toContain('ok')
  })
})
