import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parse } from '@vue/compiler-sfc'

const servicePath = fileURLToPath(
  new URL('../src/services/campusPulseApi.js', import.meta.url),
)
const panelPath = fileURLToPath(
  new URL(
    '../src/components/campus-pulse/RunExecutionPanel.vue',
    import.meta.url,
  ),
)

const [serviceSource, panelSource] = await Promise.all([
  readFile(servicePath, 'utf8'),
  readFile(panelPath, 'utf8'),
])

test('aggregate report helper freezes JSON and HTML as read-only future routes', () => {
  assert.match(
    serviceSource,
    /export function getRunAggregateReportRoute\(runId, format\)/,
  )
  assert.match(
    serviceSource,
    /`\/runs\/\$\{encodeURIComponent\(runId\)\}\/reports\/aggregate\.\$\{/,
  )
  assert.match(serviceSource, /new Set\(\['json', 'html'\]\)/)
  assert.match(
    serviceSource,
    /export async function downloadRunAggregateReport\(runId, format\)/,
  )
  assert.match(serviceSource, /responseType: 'blob'/)
  assert.doesNotMatch(
    serviceSource,
    /client\.(post|put|patch|delete)\(\s*getRunAggregateReportRoute/,
  )
})

test('panel recognizes aggregate-result-v2 and reads only aggregate comparison fields', () => {
  for (const field of [
    'campus-pulse-live-aggregate-result-v2',
    'phase_breakdowns',
    'variation_summary',
    'dimension_id',
    'category_id',
    'expected_agent_turns',
    'turns_completed',
    'effective_concurrency_limit',
    'plan_provider_call_limit',
    'authorization_provider_call_cap',
    'effective_provider_call_limit',
    'provider_calls_reserved',
    'provider_calls_completed',
    'provider_calls_known',
    'provider_calls_unknown',
    'plan_token_limit',
    'authorization_token_cap',
    'effective_token_limit',
    'tokens_in_flight',
    'provider_reported_tokens',
    'risk_charged_tokens',
    'cache_hits',
    'active_attempts',
    'peak_concurrency',
  ]) {
    assert.ok(panelSource.includes(field), `missing aggregate-v2 field: ${field}`)
  }
  assert.match(panelSource, /策略 × 种子 × 阶段聚合对比/)
  assert.match(panelSource, /跨种子 variation/)
  assert.match(panelSource, /执行预算与消耗边界/)
})

test('fixture and authorized-live publication paths stay visibly distinct', () => {
  for (const requiredText of [
    '确定性测试夹具 / DETERMINISTIC TEST FIXTURE',
    '不可作为治理结论、政策效果或真实舆情判断',
    '确定性测试夹具不可下载，也不可作为治理结论',
    '夹具 transport 调用',
    '合成 Token 账本',
    'synthetic reported',
    'Provider 调用',
    '风险计费 Token',
    'provider reported',
    'authorized_live_llm',
    'authorized_live_aggregate',
    '下载 JSON',
    '下载 HTML',
    '后端报告下载路由尚未开放；未生成或伪造文件。',
  ]) {
    assert.ok(panelSource.includes(requiredText), `missing UI boundary: ${requiredText}`)
  }
  assert.match(panelSource, /v-else-if="isAuthorizedLiveV2"/)
  assert.match(panelSource, /@click="requestAggregateReport\('json'\)"/)
  assert.match(panelSource, /@click="requestAggregateReport\('html'\)"/)
  assert.match(panelSource, /downloadRunAggregateReport\(runId, format\)/)
  assert.match(panelSource, /\[404, 409, 501\]\.includes\(status\)/)
  assert.ok(
    panelSource.indexOf("contentType !== expectedType")
      < panelSource.indexOf('globalThis.URL.createObjectURL(reportBlob)'),
    'the server content type must be validated before any browser download',
  )
})

test('claim boundary is complete and cannot be upgraded to causal or observed truth', () => {
  for (const status of [
    'model_conditional_simulation',
    'not_identified',
    'not_forecast',
    'not_population_estimate',
    'not_individual_truth',
    'not_observed_opinion',
    'not_real_time',
  ]) {
    assert.ok(panelSource.includes(status), `missing claim status: ${status}`)
  }
  assert.match(panelSource, /模型条件模拟 · 非因果识别 · 非预测 · 非总体民意/)
  assert.match(panelSource, /aggregateV2BoundaryValid/)
})

test('aggregate-v2 view has no utterance, persona, transcript or source-ID read path', () => {
  assert.doesNotMatch(
    `${serviceSource}\n${panelSource}`,
    /['"`]\/[^'"`]*(?:utterance|persona|transcript|synthetic-message|source-id)/i,
  )
  assert.doesNotMatch(
    panelSource,
    /\.\s*(?:utterance|utterances|persona|personas|transcript|source_id|source_ids)\b/i,
  )
  assert.match(panelSource, /不展示任何合成发言、人物画像或来源标识/)
})

test('run execution panel remains a valid Vue single-file component', () => {
  const parsed = parse(panelSource, { filename: panelPath })
  assert.deepEqual(parsed.errors, [])
  assert.ok(parsed.descriptor.scriptSetup)
  assert.ok(parsed.descriptor.template)
  assert.ok(parsed.descriptor.styles.length)
})
