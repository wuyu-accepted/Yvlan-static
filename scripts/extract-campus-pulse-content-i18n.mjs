import fs from 'node:fs'
import path from 'node:path'

const frontendRoot = path.resolve(import.meta.dirname, '..')
const assets = [
  'resource-policy-live-r1.json',
  'lecture-open-choice-r4.json',
]
const strings = new Set()

function add(value) {
  if (typeof value !== 'string') return
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized && /[\u3400-\u9fff]/.test(normalized)) strings.add(normalized)
}

for (const file of assets) {
  const document = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'public', 'campus-pulse-data', file), 'utf8'))
  const branches = document?.result?.branches || {}
  for (const branch of Object.values(branches)) {
    for (const message of branch?.messages || []) add(message?.visible_text)
  }
}

const result = {
  schema_version: 'campus-pulse-content-translation-source-v1',
  source_assets: assets,
  strings: [...strings].sort((left, right) => left.localeCompare(right, 'zh-CN')),
}
const output = path.join(frontendRoot, 'src', 'campus-pulse', 'i18n', 'contentStrings.zh.json')
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output, strings: result.strings.length }))
