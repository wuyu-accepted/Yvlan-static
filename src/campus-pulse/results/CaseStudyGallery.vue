<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { loadLectureHero } from '../../services/lectureHero.ts'
import { loadResourceFlagshipSummary, type ResourceFlagshipSummary } from '../../services/resourceFlagship.ts'
import { loadResourcePolicyHero } from '../../services/resourcePolicyHero.ts'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import ContentTranslation from '../i18n/ContentTranslation.vue'
import { currentLocale } from '../i18n/locale.ts'
import ResourceFlagshipPanel from './ResourceFlagshipPanel.vue'
import { useSourceContext } from '../source/sourceContext.ts'
import { auditedReplayAdapter } from '../adapters/auditedReplayAdapter.ts'
import type { ResultViewModel } from '../domain/viewModels.ts'
import {
  HERO_RESULT_KEY,
  HERO_SOURCE_KEY,
  LECTURE_HERO_RESULT_KEY,
  LECTURE_HERO_SOURCE_KEY,
} from '../source/registry.ts'

const loading = ref(true)
const error = ref('')
const resourceResult = ref<ResultViewModel | null>(null)
const lectureResult = ref<ResultViewModel | null>(null)
const lectureStep = ref(0)
const lecturePlaying = ref(false)
const flagshipSummary = ref<ResourceFlagshipSummary | null>(null)
const flagshipError = ref('')
const route = useRoute()
const sourceContext = useSourceContext()
let lectureTimer: ReturnType<typeof setInterval> | undefined

async function loadCases() {
  loading.value = true
  error.value = ''
  flagshipError.value = ''
  const [resource, lecture, flagship] = await Promise.allSettled([
    loadResourcePolicyHero(),
    loadLectureHero(),
    loadResourceFlagshipSummary(),
  ])
  if (resource.status === 'fulfilled') resourceResult.value = auditedReplayAdapter.result('hero', resource.value)
  if (lecture.status === 'fulfilled') lectureResult.value = auditedReplayAdapter.result('lecture', lecture.value)
  if (flagship.status === 'fulfilled') flagshipSummary.value = flagship.value
  else flagshipError.value = '三种子五方案结果未通过文件哈希与公开结果合同校验。'
  if (!resourceResult.value || !lectureResult.value) {
    error.value = '一个或多个案例未通过文件哈希与公开结果合同校验。'
  }
  if (resourceResult.value && lectureResult.value) {
    sourceContext.publishSourceState(route.fullPath, {
      key: 'verified-case-center',
      mode: 'offline_hero',
      label: '已校验案例结果',
      verification: 'verified',
      freshness: { status: 'unknown' },
      availability: { backend: 'unknown', access: 'readonly' },
      provenance: {
        manifestAvailable: true,
        evidenceId: 'resource-policy-r1+lecture-open-choice-r4',
        origin: 'hash-verified bundled evidence',
      },
      publicationEligible: false,
      boundaries: ['住宿资源与讲座冲突两个案例已分别通过公开文件哈希和结果合同校验；其他资产保持独立校验状态。'],
      boundarySummary: '案例中心的两个登记案例已校验。',
    })
  }
  loading.value = false
}

const resourceStory = computed(() => resourceResult.value?.resourcePolicy || null)
const resourceIntervention = computed(() => resourceStory.value?.branchSummaries.find((item) => item.branch === 'D'))
const resourceLoop = computed(() => resourceStory.value?.closedLoops[0] || null)
const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh: string, en: string) => isEnglish.value ? en : zh
const publicDemo = import.meta.env.VITE_PUBLIC_DEMO === 'true'

const lectureSteps = computed(() => {
  const forum = lectureResult.value?.forum
  if (!forum) return []
  const messages = forum.messages
  const byId = new Map(messages.map((message) => [message.message_id, message]))
  const complete = forum.governance.uptakeChains.find((chain) => chain.complete && chain.residentResponseIds.length)
  const governance = complete ? byId.get(complete.governanceMessageId) : undefined
  const response = complete ? byId.get(complete.residentResponseIds[0]) : undefined
  const firstResident = [...messages]
    .filter((message) => !message.source_display_id.startsWith('governance:'))
    .sort((left, right) => left.created_tick - right.created_tick)[0]
  const later = response
    ? messages.find((message) => message.thread_id === response.thread_id && message.created_tick > response.created_tick)
    : undefined
  return [
    firstResident && { messageId: firstResident.message_id, tick: firstResident.created_tick, label: l('事件进入论坛', 'The incident enters the forum'), text: firstResident.visible_text },
    governance && { messageId: governance.message_id, tick: governance.created_tick, label: l('学校回应进入讨论', 'The school response enters the discussion'), text: governance.visible_text },
    response && { messageId: response.message_id, tick: response.created_tick, label: l('居民直接回应', 'A resident responds directly'), text: response.visible_text },
    later && { messageId: later.message_id, tick: later.created_tick, label: l('讨论继续发展', 'The discussion continues'), text: later.visible_text },
  ].filter((item): item is NonNullable<typeof item> => Boolean(item))
})
const activeLectureStep = computed(() => lectureSteps.value[lectureStep.value] || null)
const lectureFinal = computed(() => lectureResult.value?.summary.timeline.at(-1) || null)
const lectureNatural = computed(() => lectureFinal.value?.natural || null)
const lectureIntervention = computed(() => lectureFinal.value?.intervention || null)
const percentagePoint = (value: number | null | undefined, baseline: number | null | undefined) => (
  typeof value === 'number' && typeof baseline === 'number'
    ? `${((value - baseline) * 100) >= 0 ? '+' : ''}${((value - baseline) * 100).toFixed(1)}`
    : '—'
)

function stopLecture() {
  lecturePlaying.value = false
  if (lectureTimer) clearInterval(lectureTimer)
  lectureTimer = undefined
}

function selectLectureStep(index: number) {
  stopLecture()
  lectureStep.value = index
}

function playLecture() {
  if (!lectureSteps.value.length) return
  stopLecture()
  lectureStep.value = 0
  lecturePlaying.value = true
  lectureTimer = setInterval(() => {
    const last = lectureSteps.value.length - 1
    if (lectureStep.value >= last) {
      stopLecture()
      return
    }
    lectureStep.value += 1
  }, 1500)
}

onMounted(loadCases)
onBeforeUnmount(stopLecture)
</script>

<template>
  <section class="case-gallery" aria-labelledby="case-gallery-title">
    <header class="case-gallery__head">
      <div>
        <p class="section-label" data-no-localize>{{ l('VERIFY · 案例验证', 'VERIFY · CASE EVIDENCE') }}</p>
        <h2 id="case-gallery-title">{{ l('我们用平行论坛预演：学校怎样回应，讨论会走向哪里', 'We use parallel forums to rehearse how different responses change the discussion') }}</h2>
        <p>{{ l('先读事件、治理选择和结论；需要核验时，再展开数据和完整演化过程。', 'Start with the incident, the response choices, and the takeaway. Expand the evidence only when you need to verify it.') }}</p>
      </div>
      <button v-if="error || flagshipError" type="button" @click="loadCases">重新校验</button>
    </header>

    <div v-if="loading" class="case-state" role="status">正在校验案例结果文件…</div>
    <p v-else-if="error && !resourceResult && !lectureResult" class="case-state case-state--error" role="alert">{{ error }}</p>

    <template v-else>
      <section v-if="!publicDemo" class="template-launcher" aria-label="案例模板">
        <div><span>TEMPLATE LIBRARY</span><strong>{{ l('把已验证案例复制到项目流程', 'Copy a verified case into the project flow') }}</strong><p>{{ l('保留固定 Agent 世界，重新配置事件、分支、预算和模型。', 'Keep the fixed Agent world, then reconfigure the event, branches, budget, and model.') }}</p></div>
        <nav><RouterLink :to="{name:'campus-pulse-project-new',query:{template:'housing'}}">{{ l('复制住宿案例', 'Copy housing') }}</RouterLink><RouterLink :to="{name:'campus-pulse-project-new',query:{template:'lecture'}}">{{ l('复制讲座案例', 'Copy lecture') }}</RouterLink></nav>
      </section>
      <div class="case-grid">
      <article v-if="resourceStory" class="case-card case-card--effective">
        <div class="case-card__identity">
          <CpStatusBadge tone="success">{{ l('形成可追责的服务闭环', 'An accountable service loop formed') }}</CpStatusBadge>
          <span>{{ l('案例一', 'Case 1') }}</span>
        </div>
        <h3>{{ l('暑期住宿床位怎么分，学生才觉得公平？', 'How can summer housing allocation feel fair?') }}</h3>
        <p class="case-card__event">{{ isEnglish ? `${resourceStory.scenarioFacts.validApplications} applications competed for ${resourceStory.scenarioFacts.bedsAfter} beds, but the notice did not explain ranking, document review, or appeals.` : `${resourceStory.scenarioFacts.validApplications} 份申请竞争 ${resourceStory.scenarioFacts.bedsAfter} 张床位，但公告没有讲清排序、材料复核和申诉规则。` }}</p>

        <div class="case-card__story">
          <div><span>1</span><p><strong>{{ l('我们比较了三种回应', 'We compared three responses') }}</strong>{{ l('学校不再回应、只解释规则、解释规则并提供服务入口。', 'No further response, explanation only, and explanation with a service entry point.') }}</p></div>
          <div><span>2</span><p><strong>{{ l('最重要的发现', 'The key finding') }}</strong>{{ l('仅仅把规则说清楚还不够；当求助有人接、处理有回执、居民还能继续反馈时，争议才真正开始收敛。', 'Explanation alone was not enough. The dispute began to converge only when help was received, acknowledged, and followed up.') }}</p></div>
        </div>

        <div class="case-card__takeaway"><span>{{ l('一句话结论', 'In one sentence') }}</span><strong>{{ l('透明规则解决“看不懂”，服务闭环解决“没人管”。', 'Clear rules solve confusion; a service loop solves the feeling that nobody is responsible.') }}</strong></div>

        <blockquote v-if="resourceLoop">
          <span>{{ l('仿真论坛中的直接承接链', 'Direct uptake chain from the simulated forum') }}</span>
          <p data-content-language="zh">“{{ resourceLoop.helpText }}”</p>
          <ContentTranslation :text="resourceLoop.helpText" />
          <footer>{{ l('随后收到服务回执，并由同一居民继续反馈。', 'A service receipt follows, and the same resident continues the feedback loop.') }}</footer>
        </blockquote>

        <details class="case-card__evidence">
          <summary>{{ l('查看关键数据', 'View key evidence') }}</summary>
          <dl class="case-card__comparison">
            <div><dt>{{ l('学校不再回应', 'No further response') }}</dt><dd>{{ l('61 个主要观点，没有形成闭环', '61 claims, no closed loop') }}</dd></div>
            <div><dt>{{ l('只解释规则', 'Explanation only') }}</dt><dd>{{ l('60 个主要观点，没有形成闭环', '60 claims, no closed loop') }}</dd></div>
            <div class="selected"><dt>{{ l('解释并承接服务', 'Explanation with service handoff') }}</dt><dd>{{ isEnglish ? `45 claims, ${resourceIntervention?.serviceClosures ?? '—'} closed loops` : `45 个主要观点，${resourceIntervention?.serviceClosures ?? '—'} 条服务闭环` }}</dd></div>
          </dl>
        </details>

        <div class="case-card__actions">
          <RouterLink :to="{ name:'campus-pulse-result-forum', params:{ resultKey:HERO_RESULT_KEY }, query:{ source:HERO_SOURCE_KEY, tick:'3', branch:'both', autoplay:'1' } }">{{ l('播放演化过程', 'Play the evolution') }}</RouterLink>
          <RouterLink class="secondary" :to="{ name:'campus-pulse-result-summary', params:{ resultKey:HERO_RESULT_KEY }, query:{ source:HERO_SOURCE_KEY } }">{{ l('查看完整分析', 'View full analysis') }}</RouterLink>
        </div>
      </article>

      <article v-if="lectureResult" class="case-card case-card--warning">
        <div class="case-card__identity">
          <CpStatusBadge tone="success">{{ l('讨论更聚焦，信任有所恢复', 'Discussion focused and trust recovered') }}</CpStatusBadge>
          <span>{{ l('案例二', 'Case 2') }}</span>
        </div>
        <h3>{{ l('公开道歉之后，学校还应该做什么？', 'What should the school do after a public apology?') }}</h3>
        <p class="case-card__event">{{ l('校外讲者被确认在校园讲座中辱骂学生并公开道歉，但学生仍在追问：伤害如何被承认、责任由谁承担、学校怎样避免类似事件再次发生。', 'An external speaker was confirmed to have abused students and apologized publicly, but students still asked how harm would be acknowledged, who was responsible, and how recurrence would be prevented.') }}</p>

        <div class="case-card__story">
          <div><span>1</span><p><strong>{{ l('我们比较了两种走向', 'We compared two paths') }}</strong>{{ l('让讨论自然发展，或者由学校主动说明责任、回应诉求并持续跟进。', 'Let the discussion evolve on its own, or have the school clarify responsibility, respond to concerns, and follow up.') }}</p></div>
          <div><span>2</span><p><strong>{{ l('最重要的发现', 'The key finding') }}</strong>{{ l('主动回应没有让大家闭嘴，发言反而略有增加；但重复争议显著减少，讨论开始围绕责任和后续保障收敛。', 'The response did not silence discussion. Participation rose slightly, while repeated disputes fell and the conversation converged around responsibility and support.') }}</p></div>
        </div>

        <div class="case-card__takeaway"><span>{{ l('一句话结论', 'In one sentence') }}</span><strong>{{ l('道歉结束一场发言，持续回应才能修复一段关系。', 'An apology ends a statement; continued response begins to repair a relationship.') }}</strong></div>

        <div class="correction-player" :class="{ playing: lecturePlaying }" aria-live="polite">
          <ol>
            <li
              v-for="(step, index) in lectureSteps"
              :key="step.messageId"
              :class="{ active:index === lectureStep, done:index < lectureStep }"
            >
              <button type="button" @click="selectLectureStep(index)">
                <span>Tick {{ step.tick }}</span><strong>{{ step.label }}</strong>
              </button>
            </li>
          </ol>
          <blockquote v-if="activeLectureStep">
            <span>{{ activeLectureStep.label }} · Tick {{ activeLectureStep.tick }}</span>
            <p data-content-language="zh">“{{ activeLectureStep.text }}”</p>
            <ContentTranslation :text="activeLectureStep.text" />
          </blockquote>
        </div>

        <details class="case-card__evidence">
          <summary>{{ l('查看关键数据', 'View key evidence') }}</summary>
          <dl class="case-card__comparison">
            <div><dt>{{ l('讨论自然发展', 'Discussion evolves naturally') }}</dt><dd>{{ isEnglish ? `${lectureNatural?.claims ?? '—'} claims, ${lectureResult.summary.naturalMessages ?? '—'} messages` : `${lectureNatural?.claims ?? '—'} 个主要观点，${lectureResult.summary.naturalMessages ?? '—'} 条发言` }}</dd></div>
            <div><dt>{{ l('学校主动回应', 'The school responds actively') }}</dt><dd>{{ isEnglish ? `${lectureIntervention?.claims ?? '—'} claims, ${lectureResult.summary.interventionMessages ?? '—'} messages` : `${lectureIntervention?.claims ?? '—'} 个主要观点，${lectureResult.summary.interventionMessages ?? '—'} 条发言` }}</dd></div>
            <div class="selected"><dt>{{ l('群体状态变化', 'Population-state change') }}</dt><dd>{{ isEnglish ? `Trust ${percentagePoint(lectureIntervention?.trust, lectureNatural?.trust)} percentage points; concern ${percentagePoint(lectureIntervention?.concern, lectureNatural?.concern)} percentage points` : `信任 ${percentagePoint(lectureIntervention?.trust, lectureNatural?.trust)} 个百分点；担忧 ${percentagePoint(lectureIntervention?.concern, lectureNatural?.concern)} 个百分点` }}</dd></div>
          </dl>
        </details>

        <div class="case-card__actions">
          <button type="button" @click="playLecture">{{ lecturePlaying ? l('正在播放…', 'Playing…') : l('播放四步回应过程', 'Play the four-step response') }}</button>
          <RouterLink :to="{ name:'campus-pulse-result-forum', params:{ resultKey:LECTURE_HERO_RESULT_KEY }, query:{ source:LECTURE_HERO_SOURCE_KEY, tick:'3', branch:'both', autoplay:'1' } }">{{ l('播放演化过程', 'Play the evolution') }}</RouterLink>
          <RouterLink class="secondary" :to="{ name:'campus-pulse-result-summary', params:{ resultKey:LECTURE_HERO_RESULT_KEY }, query:{ source:LECTURE_HERO_SOURCE_KEY } }">{{ l('查看完整分析', 'View full analysis') }}</RouterLink>
        </div>
      </article>
      </div>
      <details v-if="flagshipSummary" class="full-evidence">
        <summary>{{ l('查看完整的多方案对照与验证数据', 'View the full multi-policy comparison and validation data') }}</summary>
        <ResourceFlagshipPanel :summary="flagshipSummary" />
      </details>
    </template>

    <p v-if="error" class="case-warning" role="note">{{ error }} 已通过校验的案例仍可查看，失败案例不会以占位数据替代。</p>
    <details v-if="flagshipError" class="case-warning case-diagnostic" role="note">
      <summary>{{ l('部分扩展验证数据暂不可用', 'Some extended validation data is unavailable') }}</summary>
      <p>{{ flagshipError }}</p>
      <RouterLink v-if="!publicDemo" to="/campus-pulse/system">{{ l('查看数据与校验状态', 'Inspect data and verification status') }}</RouterLink>
    </details>
  </section>
</template>


<style scoped>
.case-gallery { display:grid; gap:var(--cp-space-5); padding-top:var(--cp-space-6); }
.case-gallery__head { display:flex; align-items:flex-end; justify-content:space-between; gap:var(--cp-space-6); padding-top:var(--cp-space-6); border-top:1px solid var(--cp-tech-line); }
.case-gallery__head h2 { max-width:70rem; margin:0; font-size:clamp(1.7rem,2.6vw,2.6rem); line-height:1.18; letter-spacing:-.025em; }
.case-gallery__head p:last-child { max-width:56rem; margin:var(--cp-space-3) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-md); line-height:1.75; }
.case-warning.case-diagnostic { padding:var(--cp-space-3); border:1px solid var(--cp-warning); background:var(--cp-warning-surface); color:var(--cp-text-primary); }
.case-diagnostic summary { cursor:pointer; font-weight:750; }
.case-diagnostic p { margin:var(--cp-space-2) 0; }
.case-diagnostic a { color:var(--brand-red); font-weight:700; text-decoration:none; }
.section-label { display:flex; align-items:center; gap:var(--cp-space-2); margin:0 0 var(--cp-space-3); color:var(--cp-tech); font-size:var(--cp-text-sm); font-weight:800; letter-spacing:.08em; }
.case-gallery__head button { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); background:var(--cp-surface-default); color:var(--cp-text-primary); font-weight:650; }
.case-state { padding:var(--cp-space-5); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); color:var(--cp-text-secondary); }
.case-state--error,.case-warning { color:var(--cp-danger); }
.template-launcher{display:flex;align-items:center;justify-content:space-between;gap:var(--cp-space-4);padding:var(--cp-space-4);border:1px solid var(--cp-border-default);border-left:4px solid var(--cp-action-primary);background:var(--cp-surface-subtle)}.template-launcher>div{display:grid;gap:.3rem}.template-launcher span{color:var(--cp-action-primary);font:800 var(--cp-text-xs)/1 var(--cp-font-mono);letter-spacing:.08em}.template-launcher strong{font-size:var(--cp-text-lg)}.template-launcher p{margin:0;color:var(--cp-text-secondary);font-size:var(--cp-text-xs)}.template-launcher nav{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:var(--cp-space-2)}.template-launcher a{padding:.7rem .9rem;border:1px solid var(--cp-border-strong);background:var(--cp-surface-default);color:var(--cp-text-primary);font-size:var(--cp-text-xs);font-weight:750;text-decoration:none;white-space:nowrap}.template-launcher a:last-child{border-color:var(--cp-action-primary);background:var(--cp-action-primary);color:#fff}
.template-launcher{gap:var(--cp-space-5);padding:var(--cp-space-5);border-color:var(--cp-tech-line);border-left-color:var(--cp-tech-bright);border-radius:var(--cp-radius-md);background:linear-gradient(110deg,var(--cp-tech-surface),var(--cp-surface-default))}
.template-launcher span{color:var(--cp-tech)}
.case-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--cp-space-4); }
.case-card { display:flex; min-width:0; flex-direction:column; gap:var(--cp-space-4); padding:var(--cp-space-6); border:1px solid var(--cp-border-default); border-top:4px solid var(--cp-success); border-radius:var(--cp-radius-lg); background:var(--cp-surface-default); box-shadow:var(--cp-shadow-card); }
.case-card--warning { border-top-color:var(--cp-warning); }
.case-card__identity { display:flex; align-items:center; justify-content:space-between; gap:var(--cp-space-3); }
.case-card__identity > span { color:var(--cp-text-muted); font:700 var(--cp-text-xs)/1 var(--cp-font-mono); letter-spacing:.08em; }
.case-card h3 { margin:0; font-size:var(--cp-text-xl); }
.case-card__event { min-height:3.4rem; margin:0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.65; }
.case-card__story { display:grid; gap:var(--cp-space-2); }
.case-card__story > div { display:grid; grid-template-columns:2rem minmax(0,1fr); gap:var(--cp-space-3); align-items:start; padding:var(--cp-space-3); border:1px solid var(--cp-border-subtle); background:var(--cp-surface-subtle); }
.case-card__story > div > span { display:grid; width:2rem; height:2rem; place-items:center; border-radius:50%; background:var(--cp-action-primary); color:var(--cp-surface-default); font-weight:800; }
.case-card__story p { display:grid; gap:.3rem; margin:0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.65; }
.case-card__story strong { color:var(--cp-text-primary); font-size:var(--cp-text-sm); }
.case-card__takeaway { display:grid; gap:var(--cp-space-1); padding:var(--cp-space-4); border-left:4px solid var(--cp-action-primary); background:var(--cp-surface-selected); }
.case-card__takeaway span { color:var(--cp-action-primary); font-size:var(--cp-text-xs); font-weight:800; }
.case-card__takeaway strong { font-size:var(--cp-text-lg); line-height:1.45; }
.case-card__evidence { border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.case-card__evidence summary,.full-evidence > summary { padding:var(--cp-space-3) var(--cp-space-4); color:var(--cp-action-primary); font-size:var(--cp-text-sm); font-weight:750; cursor:pointer; }
.case-card__evidence[open] summary { border-bottom:1px solid var(--cp-border-default); }
.case-card__comparison { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); margin:0; border:1px solid var(--cp-border-default); }
.case-card__evidence .case-card__comparison { border:0; }
.case-card__comparison div { min-width:0; padding:var(--cp-space-3); border-right:1px solid var(--cp-border-subtle); }
.case-card__comparison div:last-child { border-right:0; }
.case-card__comparison .selected { background:var(--cp-surface-selected); }
.case-card__comparison dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.case-card__comparison dd { margin:var(--cp-space-1) 0 0; color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:750; }
.case-card blockquote { margin:0; padding:var(--cp-space-3); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.case-card blockquote span { color:var(--cp-action-primary); font-size:var(--cp-text-xs); font-weight:750; }
.case-card blockquote p { margin:var(--cp-space-2) 0; color:var(--cp-text-primary); font-size:var(--cp-text-sm); line-height:1.6; }
.case-card blockquote footer { color:var(--cp-text-muted); font-size:var(--cp-text-xs); line-height:1.5; }
.case-card__actions { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); margin-top:auto; }
.case-card__actions a { display:inline-flex; min-height:var(--cp-control-height); align-items:center; padding:0 var(--cp-space-3); border:1px solid var(--cp-action-primary); background:var(--cp-action-primary); color:var(--cp-surface-default); font-size:var(--cp-text-sm); font-weight:700; text-decoration:none; }
.case-card__actions > button { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-action-primary); background:var(--cp-action-primary); color:var(--cp-surface-default); font-size:var(--cp-text-sm); font-weight:700; cursor:pointer; }
.case-card__actions a.secondary { border-color:var(--cp-border-strong); background:var(--cp-surface-default); color:var(--cp-text-primary); }
.correction-player { display:grid; gap:var(--cp-space-3); padding:var(--cp-space-3); border:1px solid var(--cp-border-default); background:var(--cp-surface-subtle); }
.correction-player ol { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:0; margin:0; padding:0; list-style:none; }
.correction-player li { position:relative; border-top:2px solid var(--cp-border-strong); }
.correction-player li.done,.correction-player li.active { border-color:var(--cp-action-primary); }
.correction-player button { display:grid; gap:.2rem; width:100%; padding:var(--cp-space-2); border:0; background:transparent; color:var(--cp-text-muted); text-align:left; cursor:pointer; }
.correction-player li.active button { background:var(--cp-surface-selected); color:var(--cp-text-primary); }
.correction-player button span { font:700 var(--cp-text-xs)/1 var(--cp-font-mono); }
.correction-player button strong { font-size:var(--cp-text-xs); }
.correction-player blockquote { animation:case-step-in .32s ease both; }
.full-evidence { border:1px solid var(--cp-border-default); background:var(--cp-surface-subtle); }
.full-evidence[open] > summary { border-bottom:1px solid var(--cp-border-default); }
.full-evidence :deep(.flagship-panel) { border:0; border-top:0; box-shadow:none; }
@keyframes case-step-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
.case-warning { margin:0; font-size:var(--cp-text-xs); }
@media (max-width:1100px) { .case-grid { grid-template-columns:1fr; } .case-card__event { min-height:0; } }
@media (max-width:640px) { .case-gallery__head,.template-launcher { align-items:flex-start; flex-direction:column; } .template-launcher nav{justify-content:flex-start}.case-card { padding:var(--cp-space-4); } .case-card__comparison { grid-template-columns:1fr; } .case-card__comparison div { border-right:0; border-bottom:1px solid var(--cp-border-subtle); } .case-card__comparison div:last-child { border-bottom:0; } .correction-player ol { grid-template-columns:1fr 1fr; } }
@media (prefers-reduced-motion:reduce) { .correction-player blockquote { animation:none; } }
</style>
