#!/usr/bin/env node
/**
 * M07 release preflight — real checks only, no fabricated artifacts.
 *
 * Checks: Node/npm, production build, offline Hero asset (hash), backend
 * availability (informational), model release presence (external
 * dependency), and a secret/local-path scan of the build and product src.
 *
 * Usage: node scripts/m07-preflight.mjs
 * Exit codes: 0 = ready (blockers reported separately), 1 = a required
 * check failed (build missing / hero hash mismatch / secret found).
 */
import { createHash } from 'node:crypto'
import { access, readFile, readdir, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)), '..', '..')
const frontendRoot = resolve(repoRoot, 'src', 'frontend')
const distRoot = resolve(frontendRoot, 'dist')
const heroJson = resolve(frontendRoot, 'public', 'campus-pulse-data', 'forum-twin-hero-showcase-v1.json')
const heroSha = resolve(frontendRoot, 'public', 'campus-pulse-data', 'forum-twin-hero-showcase-v1.sha256')
const modelRelease = resolve(repoRoot, '_run', 'forum-twin-v1', 'model-release.json')

const FORBIDDEN_MARKERS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /D:\\Program\\/i,
  /C:\\Users\\/i,
]

const checks = []

function record(id, label, status, detail) {
  checks.push({ id, label, status, detail })
}

async function sha256OfFile(file) {
  const data = await readFile(file)
  return createHash('sha256').update(data).digest('hex')
}

async function exists(file) {
  try { await access(file); return true } catch { return false }
}

async function scanDirectory(root) {
  const textSuffixes = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.vue', '.ts'])
  const hits = []
  async function walk(dir) {
    for (const name of await readdir(dir)) {
      const file = join(dir, name)
      const info = await stat(file)
      if (info.isDirectory()) await walk(file)
      else if (textSuffixes.has(name.slice(name.lastIndexOf('.')))) {
        const text = await readFile(file, 'utf8')
        for (const pattern of FORBIDDEN_MARKERS) {
          const match = text.match(pattern)
          if (match) hits.push(relative(root, file) + ' :: ' + match[0].slice(0, 60))
        }
      }
    }
  }
  await walk(root)
  return hits
}

// 1) Node / npm
try {
  const [nodeMajor] = process.versions.node.split('.').map(Number)
  record('node', 'Node.js', nodeMajor >= 18 ? 'passed' : 'failed', 'Node ' + process.versions.node)
} catch {
  record('node', 'Node.js', 'failed', 'Node 不可用')
}

// 2) Production build
const hasDist = await exists(join(distRoot, 'index.html'))
record('dist', '生产构建（dist/index.html）', hasDist ? 'passed' : 'failed', hasDist ? '构建产物存在' : '未构建：请先运行 npm run build')

// 3) Offline Hero asset hash
const heroAssetPresent = await exists(heroJson) && await exists(heroSha)
if (!heroAssetPresent) {
  record('hero-asset', 'Offline Hero 资产', 'failed', 'json 或 sha256 声明缺失')
} else {
  const expected = (await readFile(heroSha, 'utf8')).trim().toLowerCase()
  const actual = await sha256OfFile(heroJson)
  record('hero-asset', 'Offline Hero 资产', actual === expected ? 'passed' : 'failed', actual === expected ? 'SHA-256 匹配（' + expected.slice(0, 10) + '…）' : '哈希不匹配（expected=' + expected.slice(0, 10) + '… actual=' + actual.slice(0, 10) + '…）')
}

// 4) Backend availability (informational)
try {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  const response = await fetch('http://127.0.0.1:8000/campus-pulse/v1/health', { signal: controller.signal })
  clearTimeout(timer)
  record('backend', 'CampusPulse 后端', response.ok ? 'available' : 'unavailable', 'http ' + response.status)
} catch {
  record('backend', 'CampusPulse 后端', 'unavailable', '端口 8000 未连接（离线演示不需要后端）')
}

// 5) Model release (external dependency)
const releasePresent = await exists(modelRelease)
record('model-release', '正式 model release（_run/forum-twin-v1/model-release.json）', releasePresent ? 'present' : 'missing', releasePresent ? '已存在' : '缺失：正式 live ForumTwin trace 的外部依赖，缺失时保持 Verified Offline Hero + contract-tested error path，不伪造')

// 6) Secret / local-path scan
const secretHits = []
if (hasDist) secretHits.push(...await scanDirectory(distRoot))
secretHits.push(...await scanDirectory(resolve(frontendRoot, 'src')))
record('secret-scan', 'Secret / 本机路径扫描（dist + product src）', secretHits.length === 0 ? 'passed' : 'failed', secretHits.length === 0 ? '未发现敏感标记或本机绝对路径' : secretHits.slice(0, 3).join('；'))

const failed = checks.filter((check) => check.status === 'failed')
const summary = {
  generated_at: new Date().toISOString(),
  mode: 'm07-preflight',
  ready: failed.length === 0,
  checks,
  failed: failed.map((check) => check.id),
  blockers: checks.filter((check) => check.status === 'missing').map((check) => check.id),
  blocked_count: checks.filter((check) => check.status === 'missing').length,
}
console.log(JSON.stringify(summary, null, 2))
process.exit(failed.length === 0 ? 0 : 1)
