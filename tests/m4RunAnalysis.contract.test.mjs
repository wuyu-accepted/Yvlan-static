import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('M4 run analysis is a canonical page rather than a legacy result redirect',()=>{
  const router=read('src/router/index.js')
  assert.match(router,/path: '\/campus-pulse\/runs\/:runId\/analysis'[\s\S]{0,160}component: RunAnalysisPage/)
  const routeBlock=router.match(/path: '\/campus-pulse\/runs\/:runId\/analysis'[\s\S]*?meta: productRouteMeta\.results,/)?.[0]||''
  assert.doesNotMatch(routeBlock,/redirect:/)
})
test('M4 analysis covers the ten decision questions and both data adapters',()=>{
  const page=read('src/campus-pulse/analysis/RunAnalysisPage.vue')
  for(const marker of ['发生了什么','群体差异','信息传播','私聊影响','风险出现','治理行动','分叉原因','未解决问题','成本与余险','技术与审计'])assert.match(page,new RegExp(marker))
  assert.match(page,/loadLiveManifest/);assert.match(page,/getRunAggregateResult/);assert.match(page,/未知不等于零/)
})
test('M4 cases can be copied into the six-step project flow',()=>{
  const gallery=read('src/campus-pulse/results/CaseStudyGallery.vue')
  const wizard=read('src/campus-pulse/projects/ProjectCreationWizard.vue')
  for(const key of ['housing','lecture','century_gym']){assert.match(gallery,new RegExp(`template:'${key}'`));assert.match(wizard,new RegExp(`${key}:`))}
})
