const SECTION_HEADERS = [
  '# Mission Result',
  '## Summary',
  '## Findings',
  '## Risks / Blockers',
  '## Recommended Next Actions',
  '## Confidence'
] as const

export function normalizeMissionMarkdown (raw: string, maxBytes: number): { markdown: string; summary: string } {
  let text = raw
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    text = truncateUtf8(text, maxBytes)
  }

  const hasStructure =
    text.includes('## Summary') &&
    text.includes('## Findings') &&
    text.includes('## Risks / Blockers') &&
    text.includes('## Recommended Next Actions') &&
    text.includes('## Confidence')

  if (hasStructure && text.includes('# Mission Result')) {
    return { markdown: text, summary: extractSummary(text) }
  }

  const wrapped = [
    '# Mission Result',
    '',
    '## Summary',
    text.trim() || '(no output)',
    '',
    '## Findings',
    '- (see summary)',
    '',
    '## Risks / Blockers',
    '- Unknown — output was not in the expected format.',
    '',
    '## Recommended Next Actions',
    '1. Re-run the mission or check executor configuration.',
    '',
    '## Confidence',
    'Low'
  ].join('\n')

  return { markdown: wrapped, summary: extractSummary(wrapped) }
}

function extractSummary (md: string): string {
  const m = md.match(/## Summary\s*([\s\S]*?)(?=## |\n## |$)/i)
  const block = m?.[1]?.trim() ?? ''
  const firstLine = block.split('\n').find((l) => l.trim().length > 0) ?? ''
  return firstLine.replace(/^#+\s*/, '').slice(0, 500)
}

function truncateUtf8 (s: string, maxBytes: number): string {
  const buf = Buffer.from(s, 'utf8')
  if (buf.length <= maxBytes) return s
  return buf.subarray(0, maxBytes).toString('utf8') + '\n\n…(truncated)'
}
