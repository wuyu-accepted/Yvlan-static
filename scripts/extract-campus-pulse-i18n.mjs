import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(process.cwd(), 'src')
const output = resolve(process.cwd(), 'src/campus-pulse/i18n/uiStrings.zh.json')
const included = [
  resolve(root, 'campus-pulse'),
  resolve(root, 'views/CampusPulseOverviewView.vue'),
  resolve(root, 'views/CampusPulseResultsView.vue'),
  resolve(root, 'views/CampusPulseSystemView.vue'),
  resolve(root, 'views/ForumTwinView.vue'),
]
const extensions = new Set(['.vue', '.ts', '.js'])
const han = /[\u3400-\u9fff]/

function filesAt(path) {
  const stats = statSync(path)
  if (stats.isFile()) return [path]
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name)
    return entry.isDirectory() ? filesAt(child) : [child]
  })
}

function normalize(value) {
  return value
    .replace(/\\n/g, ' ')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/\$\{[^}]+\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function addCandidate(target, raw) {
  if (/\{\{|\$\{|===|=>|\?\.|\b(?:const|return|item|props|route|Mutation)\b/.test(raw)) return
  const value = normalize(raw)
  if (!value || value.length > 500 || !han.test(value)) return
  if (/^(?:[.#@][\w-]+|--[\w-]+|rgba?\(|var\()/.test(value)) return
  if (/[{}[\]]/.test(value) || /\w+\.[A-Za-z_$]/.test(value)) return
  target.add(value)
}

function stripTemplateTags(value) {
  return value
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, '\n')
}

const strings = new Set()
const sources = []
for (const entry of included) {
  for (const file of filesAt(entry)) {
    if (!extensions.has(extname(file))) continue
    const source = readFileSync(file, 'utf8')
    sources.push(relative(process.cwd(), file).replaceAll('\\', '/'))
    // In Vue files, scan JavaScript string literals only inside <script>.
    // Treating all template quotes as JavaScript lets a closing attribute
    // quote pair with the next opening attribute quote across rendered text.
    const literalSource = extname(file) === '.vue'
      ? [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).join('\n')
      : source
    for (const match of literalSource.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)) {
      addCandidate(strings, match[2])
    }
    if (extname(file) === '.vue') {
      const template = source.match(/<template>([\s\S]*?)<\/template>/)?.[1] || ''
      for (const attribute of template.matchAll(/\s([:@#]?[\w.-]+|v-[\w:.-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) {
        const name = attribute[1]
        const value = attribute[3]
        if (name.startsWith(':') || name.startsWith('v-bind:')) {
          for (const literal of value.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)) addCandidate(strings, literal[2])
        } else {
          addCandidate(strings, value)
        }
      }
      for (const line of stripTemplateTags(template).split(/\r?\n/g)) {
        for (const segment of line.split(/\{\{[\s\S]*?\}\}/g)) addCandidate(strings, segment)
      }
    }
  }
}

const payload = {
  schema_version: 'campus-pulse-ui-strings-zh-v1',
  source_files: sources.sort(),
  strings: [...strings].sort((left, right) => left.localeCompare(right, 'zh-CN')),
}
writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output, source_files: sources.length, strings: strings.size }))
