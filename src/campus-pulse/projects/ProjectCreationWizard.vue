<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { bootstrapProject, createProject, readableApiError } from '../../services/campusPulseApi'
import { currentLocale } from '../i18n/locale.ts'
import { projectFromPayload } from '../workbench/workbenchViewModel'

const route = useRoute()
const router = useRouter()
const storageKey = 'campus-pulse:m2-project-wizard'
const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh:string,en:string) => isEnglish.value ? en : zh
const steps = computed(() => isEnglish.value
  ? ['Basics','Agent world','Incident','Governance','Run contract','Preflight']
  : ['基础信息','Agent 世界','事件情景','治理分支','运行合同','Preflight'])
const saved = (() => { try { return JSON.parse(localStorage.getItem(storageKey) || '{}') } catch { return {} } })()
const templates:Record<string,Record<string,any>> = {
  housing:{name:'暑期住宿资源分配治理预演',governance_domain:'住宿资源分配',objective:'比较规则解释、申诉入口与服务闭环如何影响资源分配争议。',event:'暑期住宿申请超过可用床位，排序、材料复核与申诉规则尚未被充分理解。',knownFacts:'申请数量、床位数量与已发布规则。',uncertainty:'不同类别的排序细则、复核责任与响应时限。',affected:'暑期留校学生、住宿管理部门'},
  lecture:{name:'校园讲座冲突回应治理预演',governance_domain:'校园公共事件回应',objective:'比较自然传播与持续责任回应对讨论收敛和信任修复的影响。',event:'校外讲者在校园活动中与学生发生冲突并公开道歉，后续责任与保障仍受关注。',knownFacts:'事件已经确认且存在公开道歉。',uncertainty:'责任边界、后续支持与防止复发措施。',affected:'参与学生、主办方、学校治理部门'},
  century_gym:{name:'世纪馆“幽灵预约”治理预演',governance_domain:'体育场地预约治理',objective:'比较证据公开、异常释放工单与跨群触达对预约争议的影响。',event:'现场场地空置，但预约系统持续显示不可预约。',knownFacts:'存在可复现的现场空置与不可预约时段。',uncertainty:'维护切场、取消、过期或未签到后的释放状态。',affected:'场馆使用者、场馆管理方、服务台'},
}
const template = typeof route.query.template==='string' ? templates[route.query.template] : undefined
const form = reactive({
  name: template?.name || saved.name || '', governance_domain: template?.governance_domain || saved.governance_domain || '', objective: template?.objective || saved.objective || '',
  world: 'fixed_1000', event: template?.event || saved.event || '', knownFacts: template?.knownFacts || saved.knownFacts || '', uncertainty: template?.uncertainty || saved.uncertainty || '', affected: template?.affected || saved.affected || '',
  branches: saved.branches || ['natural','evidence_card'], activation: saved.activation || 'full_population_keyframes', ticks: saved.ticks || 24,
  residentBudget: saved.residentBudget || 1000, seeds: saved.seeds || '20260722, 20261731', privateChat: saved.privateChat ?? true,
  groupChat: saved.groupChat ?? true, anonymity: saved.anonymity ?? true,
})
const step = computed(() => Math.min(6, Math.max(1, Number(route.query.step) || 1)))
const submitting = ref(false)
const error = ref('')
const blockers = computed(() => [
  !form.name.trim() && l('缺少项目名称','Project name is required'), !form.governance_domain.trim() && l('缺少治理领域','Governance domain is required'),
  !form.objective.trim() && l('缺少研究问题','Research question is required'), !form.event.trim() && l('事件情景尚未填写','Incident scenario is required'),
  !form.branches.includes('natural') && l('Natural 分支必须保留','The Natural branch is required'),
].filter(Boolean) as string[])

watch(form, value => localStorage.setItem(storageKey, JSON.stringify(value)), { deep:true })
function go(next:number){ router.replace({ query:{ ...route.query, step:String(next) } }) }
async function finish(){
  if(blockers.value.length) return
  submitting.value=true; error.value=''
  try{
    const project = projectFromPayload(await createProject({ name:form.name.trim(), governance_domain:form.governance_domain.trim(), objective:form.objective.trim(), evaluation_mode:'simulation_stress_test' }))
    await bootstrapProject(project.project_id)
    localStorage.removeItem(storageKey)
    await router.push({ name:'campus-pulse-project-overview', params:{ id:project.project_id } })
  }catch(reason){ error.value=readableApiError(reason) }finally{submitting.value=false}
}
</script>

<template>
  <main class="wizard">
    <header><button type="button" @click="router.push({name:'campus-pulse-project-center'})">← {{ l('项目中心','Project Center') }}</button><div><p>NEW SIMULATION PROJECT</p><h1>{{ l('六步新建向导','Six-step project wizard') }}</h1></div><span>{{ l('草稿已自动保存','Draft saved automatically') }}</span></header>
    <nav :aria-label="l('创建进度','Creation progress')"><button v-for="(label,index) in steps" :key="label" :class="{active:step===index+1,done:step>index+1}" @click="go(index+1)"><b>{{ index+1 }}</b>{{ label }}</button></nav>
    <section class="panel">
      <div v-if="step===1" class="fields"><h2>{{ l('基础信息','Basics') }}</h2><label>{{ l('项目名称','Project name') }}<input v-model="form.name" maxlength="120"></label><label>{{ l('治理领域','Governance domain') }}<input v-model="form.governance_domain" maxlength="80"></label><label>{{ l('研究问题','Research question') }}<textarea v-model="form.objective" maxlength="800" rows="5" /></label></div>
      <div v-else-if="step===2"><h2>{{ l('Agent 世界','Agent world') }}</h2><div class="world"><b>1,000</b><span>{{ l('固定合成人口','fixed synthetic population') }}</span></div><p>{{ l('包含宏观角色、微角色、利益位置与关系结构。人口世界在项目创建后可进入“Agent 世界”继续检查。','Includes macro roles, micro roles, stakeholder positions, and relationship structures. Inspect the population further in the Agent world after creating the project.') }}</p></div>
      <div v-else-if="step===3" class="fields"><h2>{{ l('事件情景','Incident scenario') }}</h2><label>{{ l('事件描述','Incident description') }}<textarea v-model="form.event" rows="4" /></label><label>{{ l('已知事实','Known facts') }}<textarea v-model="form.knownFacts" rows="3" /></label><label>{{ l('不确定信息','Unknown information') }}<textarea v-model="form.uncertainty" rows="3" /></label><label>{{ l('受影响群体','Affected groups') }}<input v-model="form.affected"></label></div>
      <div v-else-if="step===4"><h2>{{ l('治理分支','Governance branches') }}</h2><p>{{ l('Natural 固定为对照组；其余分支可组合。','Natural is the fixed control; other branches can be combined.') }}</p><label v-for="item in [['natural',l('Natural（必选）','Natural (required)')],['evidence_card',l('证据公开','Evidence disclosure')],['service_desk',l('服务承接','Service response')],['cross_group',l('跨群触达','Cross-group outreach')],['combined',l('组合治理','Combined governance')]]" :key="item[0]" class="check"><input v-model="form.branches" type="checkbox" :value="item[0]" :disabled="item[0]==='natural'">{{ item[1] }}</label></div>
      <div v-else-if="step===5" class="fields"><h2>{{ l('运行合同','Run contract') }}</h2><label>{{ l('激活模式','Activation mode') }}<select v-model="form.activation"><option value="budgeted_pps">{{ l('预算化 PPS','Budgeted PPS') }}</option><option value="full_population_keyframes">{{ l('全量关键帧','Full-population keyframes') }}</option><option value="full_population_every_tick">{{ l('全量逐 Tick','Full population every Tick') }}</option></select></label><label>{{ l('Tick 数','Tick count') }}<input v-model.number="form.ticks" type="number" min="1" max="24"></label><label>{{ l('居民预算','Resident budget') }}<input v-model.number="form.residentBudget" type="number" min="1" max="1000"></label><label>{{ l('随机种子','Random seeds') }}<input v-model="form.seeds"></label><div class="toggles"><label><input v-model="form.privateChat" type="checkbox">{{ l('私聊','Private chat') }}</label><label><input v-model="form.groupChat" type="checkbox">{{ l('群聊','Group chat') }}</label><label><input v-model="form.anonymity" type="checkbox">{{ l('匿名表达','Anonymous posting') }}</label></div></div>
      <div v-else><h2>Preflight</h2><div class="preflight"><dl><div><dt>{{ l('人口 / Tick','Population / Tick') }}</dt><dd>1,000 / {{ form.ticks }}</dd></div><div><dt>{{ l('激活模式','Activation mode') }}</dt><dd>{{ form.activation }}</dd></div><div><dt>{{ l('治理分支','Governance branches') }}</dt><dd>{{ form.branches.length }}</dd></div><div><dt>{{ l('种子','Seeds') }}</dt><dd>{{ form.seeds }}</dd></div></dl><p>{{ l('精确槽位、请求上限、Token 上限与模型将在项目内“运行配置与预检”根据后端冻结合同计算。本向导不会猜测这些数值。','Exact slots, request and token limits, and the model are calculated from the backend-frozen contract in the project run preflight. This wizard does not estimate them.') }}</p><ul v-if="blockers.length"><li v-for="item in blockers" :key="item">{{ item }}</li></ul><p v-else class="pass">{{ l('基础预检通过，可以创建项目。','Basic preflight passed. The project can be created.') }}</p></div></div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <footer><button type="button" :disabled="step===1" @click="go(step-1)">{{ l('上一步','Previous') }}</button><button v-if="step<6" class="primary" type="button" @click="go(step+1)">{{ l('下一步','Next') }}</button><button v-else class="primary" type="button" :disabled="submitting||blockers.length>0" @click="finish">{{ submitting?l('正在创建…','Creating…'):l('创建并进入项目','Create and open project') }}</button></footer>
    </section>
  </main>
</template>

<style scoped>
.wizard{min-height:calc(100vh - 7.5rem);padding:var(--cp-space-4) var(--cp-content-gutter) var(--cp-space-8);background:#0b090a;color:#f1ece7}header{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:var(--cp-space-4);max-width:1180px;margin:auto;padding:var(--cp-space-3) var(--cp-space-4);border:1px solid #2a2428;border-radius:8px;background:#151113}header button{min-height:var(--cp-control-height);padding:0 var(--cp-space-3);border:1px solid #51464c;border-radius:6px;background:transparent;color:#f1ece7;cursor:pointer}header p{margin:0;color:#9e958f;font:700 10px var(--cp-font-mono);letter-spacing:.14em}header h1{margin:4px 0 0;font-size:24px}header span{color:#9e958f;font-size:12px}nav{display:grid;grid-template-columns:repeat(6,1fr);gap:0;max-width:1180px;margin:var(--cp-space-3) auto;border:1px solid #2a2428;background:#151113}nav button{display:flex;min-width:0;min-height:48px;align-items:center;gap:8px;padding:8px 10px;border:0;border-right:1px solid #2a2428;border-radius:0;background:transparent;color:#9e958f;font-size:12px;text-align:left;cursor:pointer}nav button:last-child{border-right:0}nav b{display:grid;width:22px;height:22px;flex:none;place-items:center;background:#080708;color:#9e958f;font-size:11px}.active{box-shadow:inset 0 -3px 0 #c51642;background:#29171d!important;color:#f1ece7!important}.active b{background:#c51642;color:#f1ece7}.done{color:#f1ece7}.done b{border:1px solid #c51642;color:#f1ece7}.panel{max-width:850px;min-height:360px;margin:auto;padding:var(--cp-space-5);border:1px solid #2a2428;border-radius:8px;background:#151113}.panel h2{margin:0 0 var(--cp-space-4);font-size:22px}.panel p{color:#b9b0aa;line-height:1.6}.fields{display:grid;gap:var(--cp-space-3)}.fields label{display:grid;gap:6px;color:#b9b0aa;font-size:13px}input,textarea,select{box-sizing:border-box;width:100%;min-height:var(--cp-control-height);padding:10px 12px;border:1px solid #51464c;border-radius:6px;background:#1c1719;color:#f1ece7;font:inherit}textarea{resize:vertical}.world{display:grid;grid-template-columns:auto 1fr;align-items:baseline;gap:var(--cp-space-3);margin:var(--cp-space-4) 0;padding:var(--cp-space-4);border:1px solid #2a2428;border-left:3px solid #c51642;border-radius:4px;background:#1c1719}.world b{font-size:28px}.world span{color:#9e958f;font-size:13px}.check{display:flex;min-height:44px;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid #2a2428}.check input,.toggles input{width:auto;min-height:auto;accent-color:#c51642}.toggles{display:flex;flex-wrap:wrap;gap:var(--cp-space-4)}.preflight dl{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--cp-space-2)}.preflight dl div{padding:var(--cp-space-3);border:1px solid #2a2428;border-radius:4px;background:#1c1719}.preflight dt{color:#9e958f;font-size:11px}.preflight dd{margin:4px 0;color:#f1ece7}.pass{color:#319795!important}.error{color:#e53e3e!important}footer{display:flex;justify-content:flex-end;gap:var(--cp-space-2);margin-top:var(--cp-space-5);padding-top:var(--cp-space-3);border-top:1px solid #2a2428}footer button{min-height:var(--cp-control-height);padding:0 var(--cp-space-4);border:1px solid #51464c;border-radius:6px;background:transparent;color:#f1ece7;cursor:pointer}.primary{border-color:#c51642!important;background:#c51642!important;color:#f1ece7}.primary:hover{background:#a91137!important}button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:760px){nav{grid-template-columns:repeat(3,1fr)}nav button{border-bottom:1px solid #2a2428}header{grid-template-columns:1fr;align-items:flex-start}.panel{padding:var(--cp-space-4)}.preflight dl{grid-template-columns:1fr}}
</style>
