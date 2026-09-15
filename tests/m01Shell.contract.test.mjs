import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'

const read = (path) => readFileSync(resolve(path), 'utf8')
const walkVue = (directory) => readdirSync(directory).flatMap((name) => {
  const path = join(directory, name)
  if (statSync(path).isDirectory()) return walkVue(path)
  return path.endsWith('.vue') ? [path] : []
})

const shellDirectory = resolve('src/campus-pulse')
const shellFiles = walkVue(shellDirectory)
const productViews = [
  'src/views/CampusPulseOverviewView.vue',
  'src/views/ForumTwinView.vue',
  'src/views/CampusPulseResultsView.vue',
  'src/views/campus-pulse/workbench/WorkbenchHomeView.vue',
  'src/views/CampusPulseSystemView.vue',
]

test('M01 shell and migrated product views parse and compile', () => {
  for (const file of [...shellFiles, ...productViews.map((path) => resolve(path))]) {
    const source = readFileSync(file, 'utf8')
    const parsed = parse(source, { filename: file })
    assert.deepEqual(parsed.errors, [], `${file} parse errors`)
    const id = `m01-${file.length}`
    const script = parsed.descriptor.scriptSetup
      ? compileScript(parsed.descriptor, { id })
      : undefined
    const template = compileTemplate({
      id,
      filename: file,
      source: parsed.descriptor.template?.content || '',
      compilerOptions: { bindingMetadata: script?.bindings },
    })
    assert.deepEqual(template.errors, [], `${file} template errors`)
  }
})

test('M01 navigation preserves five product entries and adds team credits', () => {
  const navigation = read('src/campus-pulse/app/navigation.js')
  const router = read('src/router/index.js')
  assert.equal((navigation.match(/Object\.freeze\(\{ id:/g) || []).length, 6)
  assert.match(router, /path: '\/campus-pulse\/acknowledgements'/)
  assert.match(navigation, /id: 'overview'.*label: '产品首页'/)
  assert.match(navigation, /id: 'overview'.*to: '\/campus-pulse\/overview'/)
  assert.match(router, /path: '\/campus-pulse'[\s\S]*standaloneCover: true/)
  assert.match(router, /path: '\/campus-pulse\/overview'[\s\S]*meta: productRouteMeta\.overview/)
  for (const id of ['forum', 'results', 'workbench', 'system']) {
    assert.match(navigation, new RegExp(`id: '${id}'`))
    assert.match(router, new RegExp(`meta: productRouteMeta\\.${id}`))
  }
  assert.match(router, /path: '\/campus-pulse\/:pathMatch\(\.\*\)\*'/)
})

test('M01 dedicated GSAP cover stays separate from the original simulator home', () => {
  const cover = read('src/campus-pulse/landing/CampusPulseCoverPage.vue')
  const simulator = read('src/campus-pulse/simulator/SimulatorHomePage.vue')
  const manifest = read('package.json')
  assert.match(cover, /from 'gsap'/)
  assert.match(cover, /gsap\.matchMedia/)
  assert.match(cover, /prefers-reduced-motion: reduce/)
  assert.match(cover, /to="\/campus-pulse\/overview"/)
  assert.match(cover, /simulation-stage/)
  assert.match(manifest, /"gsap"/)
  assert.doesNotMatch(simulator, /simulation-stage|class="cover-nav"|standaloneCover/)
  assert.match(simulator, /CaseStudyGallery/)
  assert.match(simulator, /centuryGymProject/)
})

test('M01 product shell provides one main landmark and complete navigation semantics', () => {
  const shell = read('src/campus-pulse/app/ProductShell.vue')
  const nav = read('src/campus-pulse/app/ProductNav.vue')
  assert.equal((shell.match(/<main\b/g) || []).length, 1)
  assert.match(shell, /id="main-content"/)
  assert.match(shell, />跳到主要内容<\/a>/)
  assert.match(shell, /role="dialog"/)
  assert.match(shell, /aria-modal="true"/)
  assert.match(shell, /event\.key === 'Escape'/)
  assert.match(shell, /event\.key !== 'Tab'/)
  assert.match(nav, /aria-current=/)
  assert.match(nav, /<RouterLink/)
  assert.match(nav, /product-nav__active-rail/)
  assert.match(nav, /item\.description/)
})

test('M01 source presentation keeps concise provenance, verification and service status', () => {
  const source = read('src/campus-pulse/app/SourceStatusBar.vue')
  for (const text of ['离线审计案例', '已验证', '验证失败', '校验不匹配', '后端不可用', '运行详情']) {
    assert.match(source, new RegExp(text))
  }
  assert.doesNotMatch(source, /source-status-bar__boundary/)
  assert.doesNotMatch(source, /accessLabel/)
  assert.match(source, /tone: 'danger'/)
  assert.match(source, /fa-circle-exclamation/)
})

test('M01 migration leaves shell ownership out of five business views', () => {
  for (const path of productViews) {
    const source = read(path)
    assert.doesNotMatch(source, /WorkbenchSidebar/)
    assert.doesNotMatch(source, /<main\b|<\/main>/)
  }
  const overview = read(productViews[0])
  const forum = read(productViews[1])
  const results = read(productViews[2])
  const system = read(productViews[4])
  for (const source of [overview, results, system]) {
    assert.doesNotMatch(source, /\.product-page\s*\{[^}]*height:\s*100vh/)
  }
  assert.doesNotMatch(forum, /\.forum-page\s*\{[^}]*height:\s*100vh/)
})

test('M01 design tokens lock brand colors and shell code has motion/focus gates', () => {
  const tokens = read('src/campus-pulse/design-system/tokens.css')
  const ownedSources = [
    tokens,
    read('src/App.vue'),
    read('src/style.css'),
    ...shellFiles.map((file) => readFileSync(file, 'utf8')),
    ...productViews.map(read),
  ].join('\n')
  assert.match(tokens, /--brand-red:\s*#ae0b2a/)
  assert.match(tokens, /--brand-red-deep:\s*#8b0821/)
  assert.match(tokens, /--brand-gold:\s*#9b8a5c/)
  assert.match(tokens, /--cp-radius-lg:\s*12px/)
  assert.match(tokens, /--cp-shadow-floating:/)
  assert.match(tokens, /:focus-visible/)
  assert.match(tokens, /\.campus-pulse-app :is\(a, button, input, select, textarea, summary, \[tabindex\], \[role="button"\]\):focus-visible/)
  assert.match(tokens, /outline-offset:\s*-3px\s*!important/)
  assert.match(tokens, /inset 0 0 0 4px var\(--cp-focus-ring\)\s*!important/)
  assert.match(tokens, /outline: 3px solid var\(--cp-focus-ring\) !important/)
  assert.match(tokens, /prefers-reduced-motion:\s*reduce/)
  assert.doesNotMatch(ownedSources, /transition\s*:\s*all\b/i)
  // SVG paths use stroke focus, avoiding the path bounding-box rectangle.
  const svg = read('src/campus-pulse/agent-world/ForumWorldRuntimeStage.vue')
  assert.match(svg, /\.runtime-edge:focus-visible \.edge-line\{[^}]*stroke-width:4/)
  assert.match(svg, /\.runtime-node:focus-visible \.node-body\{[^}]*stroke-width:3/)
  const htmlFocusSources = ownedSources.replace(/\.runtime-edge:focus,\.runtime-edge:focus-visible\{[^}]*\}/g, '')
    .replace(/\.runtime-node:focus\{[^}]*\}/g, '')
  assert.doesNotMatch(htmlFocusSources, /outline\s*:\s*none\b/i)
})

test('M01 premium shell exposes product identity and runtime context without blocking scroll', () => {
  const shell = read('src/campus-pulse/app/ProductShell.vue')
  assert.match(shell, /校园论坛数字孪生/)
  assert.match(shell, /CAMPUSPULSE CONTROL DESK/)
  assert.match(shell, /可审计运行/)
  assert.match(shell, /product-main-content[^}]*overflow:auto/)
})

test('M01 shell declares desktop, compact, tablet, and narrow viewport behavior', () => {
  const shell = read('src/campus-pulse/app/ProductShell.vue')
  const tokens = read('src/campus-pulse/design-system/tokens.css')
  assert.match(shell, /max-width:1439px[^}]*min-width:1024px/)
  assert.match(shell, /max-width:1023px/)
  assert.match(shell, /max-width:767px/)
  assert.match(tokens, /--cp-touch-target:\s*2\.75rem/)
  const mode = (width) => width >= 1440 ? 'desktop' : width >= 1024 ? 'compact' : 'mobile'
  assert.deepEqual([375, 768, 1024, 1440].map(mode), ['mobile', 'mobile', 'compact', 'desktop'])
})
