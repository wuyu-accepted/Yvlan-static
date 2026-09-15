<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from '../../services/campusPulseApi'
import { currentLocale, localizeStoredText } from '../i18n/locale.ts'
import { saveProjectSetup } from './projectSetup.mjs'

const route = useRoute()
const router = useRouter()
const storageKey = 'campus-pulse:project-setup-v3'
const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh: string, en: string) => isEnglish.value ? en : zh
const templates = {
  housing: { title: ['住宿争议 · 情景草稿', 'Housing dispute · scenario draft'], name: '暑期住宿资源分配治理预演', domain: '住宿资源分配', objective: '比较资格说明、复核入口和服务反馈。', event: '暑期住宿需求超过可用床位，申请者围绕资格、排序和申诉展开讨论。', facts: '填写本次推演确认的申请与分配条件。', questions: '排序标准、复核责任和响应时限。', affected: '住宿申请者与管理部门。', policies: ['创建后检查治理动作与运行适配', 'Review governance actions and runtime compatibility after creation'] },
  lecture: { title: ['讲座冲突 · 情景草稿', 'Lecture conflict · scenario draft'], name: '讲座冲突回应治理预演', domain: '校园公共事件回应', objective: '比较事实说明、责任回应与后续支持。', event: '讲座现场冲突进入论坛，学生讨论不当言行、主办方责任与后续保障。', facts: '填写本次推演确认的事件信息。', questions: '责任回应、支持入口与防止复发的措施。', affected: '参与学生与活动主办方。', policies: ['创建后检查治理动作与运行适配', 'Review governance actions and runtime compatibility after creation'] },
  century_gym: { title: ['世纪馆预约争议', 'Century Gym booking dispute'], name: '世纪馆预约服务治理预演', domain: '世纪馆体育场地预约治理', objective: '比较预约信息公开、异常释放工单和跨群触达如何回应空场却不可预约的疑问。', event: '学生在论坛反映羽毛球、乒乓球场现场空置，但预约系统显示热门时段不可预约。', facts: '从学生观察和预约页面之间的差异开始讨论。', questions: '空场原因、取消与未签到后的释放机制、查询和反馈渠道。', affected: '场馆使用者、场馆管理方与服务台。', policies: ['预约证据卡、异常释放工单、跨群触达', 'Booking evidence cards, release tickets and outreach'] },
}
type TemplateKey = keyof typeof templates | 'custom'
const saved = (() => { try { return JSON.parse(localStorage.getItem(storageKey) || '{}') } catch { return {} } })()
const form = reactive({ template: (saved.template in templates || saved.template === 'custom' ? saved.template : 'century_gym') as TemplateKey, name: saved.name || '', domain: saved.domain || '', objective: saved.objective || '', event: saved.event || '', facts: saved.facts || '', questions: saved.questions || '', affected: saved.affected || '', scope: saved.scope || '比较合成论坛中不同群体的讨论、信息传播和治理回应。' })
const resume = reactive({ projectId: saved.projectId || '' })
const demoWorkspace = ref(false)
const availableTemplates = computed(() => Object.fromEntries(Object.entries(templates).filter(([key]) => !demoWorkspace.value || key === 'century_gym')))
onMounted(async () => {
  try {
    demoWorkspace.value = (await api.getWorkbenchHealth()).workspace?.demo === true
  } catch { /* Saving reports an unavailable API. */ }
})
const step = computed(() => Math.max(1, Math.min(3, Number(route.query.step) || 1)))
const steps = computed(() => [l('项目信息', 'Project details'), l('事件与方案', 'Incident and plans'), l('确认创建', 'Review and create')])
const template = computed(() => form.template === 'custom' ? null : templates[form.template])
const replay = computed(() => form.template === 'century_gym' || demoWorkspace.value)
const submitting = ref(false)
const error = ref('')
const validation = ref(false)
const heading = ref<HTMLElement | null>(null)
const blockers = computed(() => [
  !form.name.trim() && l('请填写项目名称。', 'Enter a project name.'),
  !form.domain.trim() && l('请填写治理领域。', 'Enter a governance domain.'),
  !form.objective.trim() && l('请填写推演目标。', 'Enter a simulation objective.'),
  !form.event.trim() && l('请填写事件描述。', 'Enter an incident description.'),
  !form.scope.trim() && l('请填写分析范围。', 'Enter an analysis scope.'),
].filter(Boolean) as string[])
function persist() { try { localStorage.setItem(storageKey, JSON.stringify({ ...form, ...resume })) } catch { /* draft storage is optional */ } }
function choose(key: TemplateKey) {
  if (resume.projectId) return
  form.template = key
  const preset = key === 'custom' ? null : templates[key]
  for (const field of ['name', 'domain', 'objective', 'event', 'facts', 'questions', 'affected'] as const) form[field] = localizeStoredText(preset?.[field] || '')
  if (!saved.scope) form.scope = l('比较合成论坛中不同群体的讨论、信息传播和治理回应。', 'Examine group discussions, information propagation and governance responses in the synthetic forum.')
}
if (!saved.name || (route.query.template && String(route.query.template) !== saved.template && !resume.projectId)) choose(route.query.template && (String(route.query.template) in templates || route.query.template === 'custom') ? String(route.query.template) as TemplateKey : 'century_gym')
watch(form, persist, { deep: true })
watch(currentLocale, () => {
  // Translate untouched preset values only; authored project text stays intact.
  const preset = template.value
  if (preset) for (const field of ['name','domain','objective','event','facts','questions','affected'] as const) {
    if (form[field] === preset[field] || form[field] === localizeStoredText(preset[field], 'en-US'))
      form[field] = localizeStoredText(preset[field])
  }
  form.scope = localizeStoredText(form.scope)
})
async function go(next: number) {
  validation.value = true
  if (next > step.value && blockers.value.length && (step.value > 1 || !form.name.trim() || !form.domain.trim() || !form.objective.trim())) return
  await router.replace({ query: { ...route.query, step: String(next) } })
  validation.value = false
  await nextTick(); heading.value?.focus()
}
async function finish() {
  if (submitting.value || blockers.value.length) return
  submitting.value = true; error.value = ''
  try {
    const id = await saveProjectSetup(api, { ...form, family: demoWorkspace.value ? 'century_gym' : form.template }, resume, persist)
    await router.push({ name: 'campus-pulse-project-overview', params: { id } })
    localStorage.removeItem(storageKey)
  } catch (reason) { error.value = api.readableApiError(reason) }
  finally { submitting.value = false }
}
</script>

<template>
  <main class="wizard" data-no-localize>
    <header><RouterLink :to="{ name: 'campus-pulse-project-center' }">← {{ l('项目中心', 'Project Center') }}</RouterLink><h1>{{ l('新建推演项目', 'New simulation project') }}</h1><p>{{ l('选择情景，确认研究目标，然后进入项目。', 'Choose a scenario, confirm your objective and open the project.') }}</p></header>
    <ol class="steps" :aria-label="l('创建进度', 'Setup progress')"><li v-for="(label, index) in steps" :key="index" :aria-current="step === index + 1 ? 'step' : undefined"><span>{{ index + 1 }}</span>{{ label }}</li></ol>
    <section class="panel" :aria-busy="submitting">
      <div :key="step" class="step-content">
      <h2 ref="heading" tabindex="-1">{{ steps[step - 1] }}</h2>
      <fieldset :disabled="submitting || Boolean(resume.projectId)">
        <template v-if="step === 1">
          <label>{{ l('项目模板', 'Project template') }}<select :value="form.template" @change="choose(($event.target as HTMLSelectElement).value as TemplateKey)"><option v-for="(item, key) in availableTemplates" :key="key" :value="key">{{ item.title[isEnglish ? 1 : 0] }}</option><option value="custom">{{ l('从空白开始', 'Start from scratch') }}</option></select><small>{{ l('模板已填写项目与事件信息，可直接检查，也可按需修改。', 'The template fills project and incident details. Review them as supplied or edit as needed.') }}</small></label>
          <p v-if="demoWorkspace" class="note">{{ l('世纪馆运行记录 · Natural / D · Tick 0–10', 'Century Gym recorded run · Natural / D · Tick 0–10') }}</p>
          <label>{{ l('项目名称', 'Project name') }}<input v-model="form.name" maxlength="120" autocomplete="off"></label>
          <label>{{ l('治理领域', 'Governance domain') }}<input v-model="form.domain" maxlength="80" ></label>
          <label>{{ l('推演目标', 'Simulation objective') }}<textarea v-model="form.objective" maxlength="800" rows="3" /></label>
        </template>
        <template v-else-if="step === 2">
          <p class="note">{{ replay ? l('定义事件的起点、已知信息与待解决问题。创建后可以在项目中统一检查人口、事件和治理方案。', 'Define the incident, known information and open questions. Review population, incident and policy plans together after creation.') : l('系统关联人口与数据，下面的事件条件会保存为本项目的新情景。治理动作与运行适配在项目内检查。', 'The system attaches population and data. The incident fields below are saved as a new scenario; review actions and runtime compatibility in the project.') }}</p>
          <label>{{ l('事件描述', 'Incident description') }}<textarea v-model="form.event"  maxlength="500" rows="3" /></label>
          <label>{{ l('已知信息', 'Known information') }}<textarea v-model="form.facts"  maxlength="150" rows="2" /></label>
          <label>{{ l('待解答的问题', 'Questions to address') }}<textarea v-model="form.questions"  maxlength="200" rows="2" /></label>
          <label>{{ l('涉及群体', 'Affected groups') }}<input v-model="form.affected"  maxlength="100"></label>
          <label v-if="form.template !== 'century_gym'">{{ l('分析范围', 'Analysis scope') }}<textarea v-model="form.scope" rows="2" maxlength="1000" /><small>{{ l('写明希望观察的讨论、服务或传播问题。', 'Describe the discussion, service or propagation questions you will examine.') }}</small></label>
        </template>
        <template v-else>
          <dl><div><dt>{{ l('项目', 'Project') }}</dt><dd>{{ form.name }}</dd></div><div><dt>{{ l('人口世界', 'Agent world') }}</dt><dd>{{ l('1,000 个合成 Agent，共享人物资料和论坛机制', '1,000 synthetic Agents with shared profiles and forum mechanics') }}</dd></div><div><dt>{{ l('情景', 'Scenario') }}</dt><dd>{{ form.event }}</dd></div><div><dt>{{ l('治理方案', 'Governance plans') }}</dt><dd>{{ replay ? 'Natural / D · ' + templates.century_gym.policies[isEnglish ? 1 : 0] : template?.policies[isEnglish ? 1 : 0] || l('在项目中选择并检查治理动作', 'Select and inspect actions in the project') }}</dd></div><div><dt>{{ l('接下来', 'Next') }}</dt><dd>{{ replay || demoWorkspace ? l('进入项目确认配置，再启动 Tick 0–10 的世纪馆记录回放，比较 Natural / D。', 'Review project configuration, then start the saved Century Gym run for Tick 0–10 and compare Natural / D.') : l('进入项目检查已保存的情景与方案，再配置模型、分支和预算并生成运行预览。', 'Inspect the saved scenario and plans, then configure the model, branches and budget to generate a run preview.') }}</dd></div></dl>
        </template>
      </fieldset>

      <div v-if="validation && blockers.length" class="error" role="alert"><p v-for="item in blockers" :key="item">{{ item }}</p></div>
      <p v-if="resume.projectId" class="note">{{ l('项目已保存。若初始化未完成，可重试继续准备同一项目。', 'The project is saved. Retry to finish setup on this same project.') }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      </div>
      <footer><span>{{ l('草稿保存在当前浏览器', 'Draft saved in this browser') }}</span><button :disabled="step === 1 || submitting" @click="go(step - 1)">{{ l('上一步', 'Back') }}</button><button v-if="step < 3" class="primary" :disabled="submitting" @click="go(step + 1)">{{ l('下一步', 'Next') }}</button><button v-else class="primary" :disabled="submitting || blockers.length > 0" @click="finish">{{ submitting ? l('正在保存与准备…', 'Saving and preparing…') : l('创建项目', 'Create project') }}</button></footer>
    </section>
  </main>
</template>

<style scoped>
.wizard{max-width:1100px;margin:0 auto;padding:24px;color:var(--cp-text-primary);background:var(--cp-surface-canvas);min-height:80vh;font-size:14px;line-height:1.6}header{margin-bottom:24px}header a{color:var(--cp-text-secondary);text-decoration:none}h1{font-size:24px;font-weight:650;margin:12px 0 4px}header p{margin:0;color:var(--cp-text-secondary)}.steps{display:flex;list-style:none;padding:0;margin:0 0 24px;border-bottom:1px solid var(--cp-border-default);gap:24px}.steps li{display:flex;gap:8px;align-items:center;padding:0 0 12px;color:var(--cp-text-secondary)}.steps li[aria-current]{color:var(--cp-action-primary);border-bottom:2px solid var(--cp-action-primary)}.steps span{font-size:12px}.panel{max-width:850px;padding:24px;border:1px solid var(--cp-border-default);border-radius:8px;background:var(--cp-surface-default)}h2{font-size:18px;margin:0 0 20px}fieldset{border:0;padding:0;margin:0;display:grid;gap:18px;min-width:0}label{display:grid;gap:6px;font-weight:550}input,textarea,select{width:100%;box-sizing:border-box;min-height:42px;padding:9px 12px;border:1px solid var(--cp-border-strong);border-radius:5px;background:var(--cp-surface-subtle);color:var(--cp-text-primary);font:inherit}textarea{resize:vertical}input[readonly],textarea[readonly]{background:var(--cp-surface-default);border-color:var(--cp-border-default);color:var(--cp-text-secondary)}small{font-size:12px;color:var(--cp-text-secondary);font-weight:400}.note{padding:12px 14px;margin:0;border:1px solid var(--cp-border-default);color:var(--cp-text-secondary);background:var(--cp-surface-selected);font-size:13px}dl{margin:0}dl>div{display:grid;grid-template-columns:110px minmax(0,1fr);gap:18px;padding:14px 0;border-bottom:1px solid var(--cp-border-default)}dt{color:var(--cp-text-secondary)}dd{margin:0;overflow-wrap:anywhere}.error{padding:12px;color:var(--cp-danger);background:var(--cp-danger-surface);border:1px solid #a85464}.error p{margin:0}footer{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:24px;padding-top:18px;border-top:1px solid var(--cp-border-default)}footer span{margin-right:auto;font-size:12px;color:var(--cp-text-secondary)}button{min-height:42px;border:1px solid var(--cp-border-strong);border-radius:5px;padding:8px 16px;background:transparent;color:var(--cp-text-primary);font:inherit;cursor:pointer;transition:background-color 160ms ease}button:hover{background:var(--cp-surface-subtle)}.primary{background:var(--cp-action-primary);border-color:var(--cp-action-primary)}.primary:hover{background:var(--cp-action-primary-hover)}button:disabled{opacity:.5;cursor:wait}:is(button,a,input,select,textarea):focus-visible{outline:2px solid var(--cp-focus-ring);outline-offset:3px}@media(max-width:600px){.wizard{padding:16px}.panel{padding:16px}.steps{gap:16px;font-size:12px}dl>div{grid-template-columns:1fr;gap:4px}footer span{flex-basis:100%}}@media(prefers-reduced-motion:reduce){button{transition:none}}
.primary{color:var(--cp-text-inverse)}
.after-create{margin-top:22px;padding-top:18px;border-top:1px solid var(--cp-border-default);gap:8px}.after-create legend{padding:0 0 10px;font-weight:650}.after-create__option{display:flex;align-items:flex-start;gap:12px;padding:12px;border:1px solid var(--cp-border-default);border-radius:6px;cursor:pointer;transition:background 180ms ease,border-color 180ms ease}.after-create__option:has(:checked){border-color:var(--cp-action-primary);background:var(--cp-surface-selected)}.after-create__option:hover{background:var(--cp-surface-subtle)}.after-create__option input{width:18px;min-height:18px;margin:3px 0 0;accent-color:var(--cp-action-primary)}.after-create__option span{display:grid;gap:4px}.after-create__option strong{font-size:14px}.after-create__option small{line-height:1.6}

.step-content{animation:cp-step-arrive 180ms var(--cp-ease-out)}
.panel[aria-busy="true"]{border-color:var(--cp-action-primary)}
@keyframes cp-step-arrive{from{opacity:.8;transform:translateX(4px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.step-content{animation:none}}
</style>
