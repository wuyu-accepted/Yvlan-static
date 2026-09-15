import { computed, nextTick, onBeforeUnmount, onMounted, ref, type Ref, watch } from 'vue'
import catalogDocument from './uiCatalog.zh-en.json'

export type CampusPulseLocale = 'zh-CN' | 'en-US'

// Route-level copy added after the original catalog snapshot. Keep these as
// exact matches so the phrase fallback cannot produce mixed-language labels.
const supplementalTranslations: Readonly<Record<string, string>> = Object.freeze({
  '项目中心': 'Project Center',
  '项目注册与治理编排': 'Project registry and governance orchestration',
  '把社会模拟从“能运行”': 'Move social simulation from “it runs”',
  '你现在想完成什么？': 'What would you like to do?',
  '首页负责说明能力与边界；具体任务从下面三个入口开始。': 'This page explains the product’s capabilities and boundaries. Start a specific task from one of the three paths below.',
  '产品任务入口': 'Product task paths',
  'START HERE · 选择入口': 'START HERE · CHOOSE A PATH',
  'BUILD · 项目': 'BUILD · PROJECT',
  '创建或继续一次推演': 'Create or continue a simulation',
  '配置事件、Agent 人口、治理方案与运行合同': 'Configure the incident, Agent population, governance plan, and run contract',
  'ENGINE · 系统逻辑': 'ENGINE · SYSTEM LOGIC',
  '理解模拟如何产生结果': 'Understand how the simulation produces results',
  '查看事件、Agent 与论坛机制如何形成可核验输出': 'See how incidents, Agents, and forum mechanics produce verifiable outputs',
  'VERIFY · 案例': 'VERIFY · CASES',
  '研究已验证的治理案例': 'Explore verified governance cases',
  '比较分支差异，并回到证据与完整运行记录': 'Compare branch differences and trace them back to evidence and complete run records',
  'CREATE · 构建推演': 'CREATE · BUILD A SIMULATION',
  '五步完成一次可审计的社会模拟': 'Build an auditable social simulation in five steps',
  '从事件定义到运行合同，每一步都能回到来源、配置与责任边界。': 'From incident definition to run contract, every step remains traceable to its source, configuration, and responsibility boundary.',
  '输入如何经过论坛机制，变成可检查的结果': 'How inputs become inspectable results through forum mechanics',
  'LLM 负责人物表达，确定性内核负责时间、可见性、资源和证据约束。': 'LLMs handle character expression; the deterministic core enforces time, visibility, resource, and evidence constraints.',
  '为什么这套模拟值得信任？': 'Why is this simulation trustworthy?',
  '查看 SMC 认知闭环、平行孪生设计、真实性评测与适用边界。': 'Review the SMC cognitive loop, parallel-twin design, fidelity evaluation, and scope of use.',
  '了解创新机制与评测': 'Explore innovation and evaluation',
  '案例模板': 'Case templates',
  '先继续最近的预演，再通过精选案例对比治理分支；需要核验时进入完整归档。': 'Continue your latest simulation, compare governance branches through featured cases, and open the full archive when verification is needed.',
  '还没有项目运行': 'No project runs yet',
  '从项目工作台创建预演后，最近记录会出现在这里。': 'Create a simulation from the project workbench and its latest run will appear here.',
  '创建第一次预演': 'Create your first simulation',
  '我的运行（默认）': 'My runs (default)',
  '全部（含官方案例）': 'All (including official cases)',
  '最近更新（新→旧）': 'Recently updated (newest first)',
  '最近更新（旧→新）': 'Recently updated (oldest first)',
  '更多筛选': 'More filters',
  '最近更新': 'Last updated',
  '创建于': 'Created',
  '继续配置': 'Continue setup',
  '集中核对服务就绪、模型连接、离线资产与证据边界。': 'Review service readiness, model connections, offline assets, and evidence boundaries in one place.',
  '创新与评测': 'Innovation and Evaluation',
  '推进到“可检查”。': 'to “it can be inspected.”',
  'CampusPulse 将真实数字足迹映射为异质性 Agent，用认知粒子限制大模型表达，并通过共享历史前缀的平行推演比较治理策略。': 'CampusPulse maps real digital traces into heterogeneous Agents, constrains LLM expression with cognitive particles, and compares governance strategies through parallel simulations with a shared history.',
  '异质性 Agent': 'Heterogeneous Agents',
  '总状态粒子': 'State particles',
  '类实证场景': 'Empirically grounded scenarios',
  '研究主线': 'Research agenda',
  '我们集中回答三个问题': 'We focus on three questions',
  '人群建模': 'Population modeling',
  '如何在不还原真实身份的前提下，保留论坛人群的行为异质性？': 'How can we preserve behavioral heterogeneity without reconstructing real identities?',
  '脱敏语义情境 → 角色聚类 → Profile → 合成 Agent': 'De-identified semantic contexts → role clusters → Profiles → synthetic Agents',
  '认知约束': 'Cognitive constraints',
  '如何让 LLM 的文本表达与动态心理状态长期保持一致？': 'How can LLM expression remain consistent with dynamic cognitive states over time?',
  'SMC 粒子状态 ↔ LLM 表达的双向闭环': 'Bidirectional loop between SMC particle states and LLM expression',
  '政策评估': 'Policy evaluation',
  '如何把治理策略的差异与随机演化的差异分离开？': 'How can governance effects be separated from random evolution?',
  '共享历史前缀 → 决策点强制分叉 → 反事实对照': 'Shared history → forced branch at the decision point → counterfactual comparison',
  '四项核心创新': 'Four core innovations',
  '数据基础': 'DATA FOUNDATION',
  '认知引擎': 'COGNITIVE ENGINE',
  '传播结构': 'DIFFUSION SYSTEM',
  '实验设计': 'EXPERIMENT DESIGN',
  '从真实数字足迹到合成人群的映射管线': 'Mapping pipeline from real digital traces to a synthetic population',
  '真实数字足迹如何成为合成人群': 'How real digital traces become a synthetic population',
  '不是人工编写少量角色标签，而是从大规模脱敏语义中逐层提炼行为结构。': 'Instead of hand-writing a few role labels, the system progressively extracts behavioral structure from large-scale de-identified semantics.',
  '原始帖子与评论': 'Raw posts and comments',
  '去重语义行': 'Deduplicated semantic lines',
  '行为情境': 'Behavioral contexts',
  'Profile 集合': 'Profile collection',
  '从人群建模、个体状态到信息传播和对照实验，把模型生成纳入可追踪的系统约束。': 'From population modeling and individual states to information diffusion and controlled experiments, model generation is governed by traceable system constraints.',
  '真实数据驱动的人群孪生': 'Data-driven population twins',
  '从脱敏论坛语义中提取行为情境、角色与 Profile，在不还原现实身份的前提下保留人群异质性。': 'Behavioral contexts, roles, and Profiles are extracted from de-identified forum semantics, preserving population heterogeneity without reconstructing real identities.',
  '17 个宏角色': '17 macro roles',
  '120 个微角色': '120 micro roles',
  '22,477 个 Profile': '22,477 Profiles',
  'SMC 认知状态双向闭环': 'Bidirectional SMC cognitive-state loop',
  '状态粒子约束 LLM 的表达边界，LLM 已表露的立场又作为观测值反向更新粒子权重，避免让模型直接自报心理数值。': 'State particles constrain LLM expression, while expressed positions become observations that update particle weights, avoiding direct self-reporting of psychological values.',
  '10 粒子 / Agent': '10 particles per Agent',
  '12 维认知状态': '12-dimensional cognitive state',
  'ESS 退化重采样': 'ESS-triggered resampling',
  '六重约束与双层传播网络': 'Six constraints and a two-layer diffusion network',
  '身份、利益位置、动态认知、局部观测、行为连续性和结构化动作共同限制 Agent，公开论坛与私聊网络分别承载显性与隐性传播。': 'Identity, stakeholder position, dynamic cognition, local observation, behavioral continuity, and structured actions jointly constrain each Agent; public forums and private chats carry visible and hidden diffusion.',
  '6 重行为约束': '6 behavioral constraints',
  '公共 + 私有渠道': 'Public + private channels',
  '8 条初始关系 / Agent': '8 initial relationships per Agent',
  '可比较的平行孪生实验': 'Comparable parallel-twin experiments',
  '干预前共享历史、随机种子与动作预算，只在指定决策点分叉，使不同治理策略的差异能够被追踪与量化。': 'Branches share history, random seeds, and action budgets before intervention, diverging only at designated decision points so governance differences remain traceable and measurable.',
  '共享演化前缀': 'Shared evolution history',
  '强制策略分叉': 'Forced policy branching',
  '反事实 + 双重差分': 'Counterfactuals + difference-in-differences',
  '粒子与 LLM 的双向认知闭环': 'Bidirectional cognitive loop between particles and LLMs',
  '系统先将粒子期望写入生成上下文，再把 Agent 的实际表达作为观测，通过贝叶斯似然更新权重。': 'The system writes particle expectations into the generation context, then treats each Agent’s expression as an observation and updates weights through Bayesian likelihood.',
  '10 个粒子': '10 particles',
  '12 维隐状态': '12-dimensional latent state',
  'LLM 表达': 'LLM expression',
  '文本、行为与立场': 'Text, behavior, and stance',
  '权重更新': 'Weight update',
  'ESS 监测与重采样': 'ESS monitoring and resampling',
  'SMC 双向闭环流程': 'Bidirectional SMC loop',
  '新状态返回下一个 Tick，继续限制 Agent 的语义边界': 'The new state enters the next Tick and continues to constrain the Agent’s semantic boundaries',
  '模拟真实性与一致性': 'Simulation fidelity and consistency',
  '评测数字来自报告中的真实论坛对齐、微观一致性和约束消融实验。': 'Evaluation figures come from real-forum alignment, micro-level consistency, and constraint-ablation experiments reported in the study.',
  '讨论帖规模 JS 散度': 'Thread-size JS divergence',
  '越接近 0，宏观分布越相似': 'Closer to 0 means more similar macro distributions',
  '上下文承接率': 'Context carryover rate',
  '基础交互质量评测': 'Baseline interaction-quality evaluation',
  '虚假事实编造率': 'False-fact fabrication rate',
  '在报告评测样本中': 'In the report’s evaluation sample',
  'LLM 输出与粒子更新对齐率': 'LLM-output and particle-update alignment',
  '语义表达与状态更新一致性': 'Consistency between semantic expression and state updates',
  '不只看“像不像”，而是逐层检验': 'Test each layer—not just whether it looks realistic',
  '从宏观生态到治理效能的四层验证框架': 'Four-layer validation framework from macro ecology to governance effectiveness',
  '宏观生态': 'Macro ecology',
  '回复规模分布与真实论坛对齐': 'Reply-size distribution aligned with real forums',
  '微观一致性': 'Micro-level consistency',
  '上下文、语言风格与状态对齐': 'Alignment of context, language style, and state',
  '群体异质性': 'Population heterogeneity',
  '利益位置能解释演化后的群体差异': 'Stakeholder positions explain emerging group differences',
  '治理动作效能': 'Governance-action effectiveness',
  '用平行分支和双重差分检查政策响应': 'Evaluate policy responses with parallel branches and difference-in-differences',
  '完整输入确实改变了 Agent 行为': 'Complete inputs materially changed Agent behavior',
  '固定外部环境，对比纯上下文、Profile 约束、状态约束与完整输入。': 'With the external environment fixed, compare context-only, Profile-constrained, state-constrained, and complete inputs.',
  '改变主动作': 'Primary action changed',
  '改变情绪表现': 'Emotional expression changed',
  '改变私聊触发': 'Private-chat trigger changed',
  '约束条件识别率': 'Constraint recognition rate',
  '平行策略对比': 'Parallel policy comparison',
  '治理介入的反直觉结果': 'The counterintuitive effects of intervention',
  '同一历史前缀、同一随机种子与动作预算下，对比 Natural 与综合干预 D 的 Tick 10 结果。': 'Tick 10 comparison of Natural and combined intervention D with the same history, random seed, and action budget.',
  '干预结果坐标图': 'Intervention outcome map',
  '干预后的信任轨迹': 'Trust trajectories after intervention',
  '从同一决策基线出发，两次治理介入都促成议题收敛，却将群体信任推向不同方向。': 'Starting from the same decision baseline, both interventions converge the debate—but move group trust in opposite directions.',
  '两个治理案例从共同决策点走向相反信任结果的动态轨迹': 'Animated trajectories showing two governance cases moving from a shared decision point toward opposite trust outcomes',
  '共同决策点': 'Shared decision point',
  '信任提升': 'Trust gained',
  '信任受损': 'Trust eroded',
  '发言变化': 'Post change',
  '信任变化': 'Trust change',
  '议题显著收敛，讨论仍保持活跃，信任同步回升。': 'The debate converged sharply while discussion stayed active and trust recovered.',
  '服务闭环并未抵消资源不足带来的程序性质询。': 'Closing the service loop did not offset procedural concerns caused by scarce resources.',
  '横轴表示群体信任变化，纵轴表示发言量变化；圆环大小表示争论主张的收敛幅度。': 'The x-axis shows change in group trust, the y-axis shows change in discussion volume, and bubble size represents claim convergence.',
  '治理干预结果坐标图': 'Governance intervention outcome map',
  '发言量变化': 'Change in discussion',
  '群体信任变化': 'Change in group trust',
  '讨论增加': 'More discussion',
  '信任下降': 'Trust decreases',
  '信任上升': 'Trust increases',
  '信任 +0.032': 'Trust +0.032',
  '信任 −0.054': 'Trust −0.054',
  '争论主张 −81.8%': 'Contested claims −81.8%',
  '争论主张 −41.2%': 'Contested claims −41.2%',
  '发言 +6': 'Posts +6',
  '发言 +3': 'Posts +3',
  '同样“议题收敛”，信任方向却相反': 'The same claim convergence produced opposite trust outcomes',
  '这正是平行推演比单一 KPI 更有价值的地方。': 'That is why parallel simulation reveals more than any single KPI.',
  '突发冲突': 'Sudden conflict',
  '资源争议': 'Resource dispute',
  '关键发现': 'Key finding',
  '治理可以让议题收敛，却不必然降低讨论量，也不自动修复信任。': 'Governance can focus an issue without reducing discussion or automatically restoring trust.',
  '条形长度仅在同一案例、同一指标内归一化，用于比较分支，不用于跨指标比较。': 'Bar lengths are normalized within each case and metric for branch comparison, not for cross-metric comparison.',
  '同一事件共享干预前历史，在决策点分为 Natural 与综合干预 D，避免把不同起点误认为政策差异。': 'The same incident shares its pre-intervention history, then branches into Natural and combined intervention D at the decision point, preventing different starting points from being mistaken for policy effects.',
  '事件投入': 'Incident input',
  '锁定共同前缀': 'Lock shared history',
  '策略分叉': 'Policy branch',
  '平行孪生分叉时间线': 'Parallel-twin branching timeline',
  'D · 综合干预': 'D · Combined intervention',
  'CASE 01 · 突发冲突': 'CASE 01 · SUDDEN CONFLICT',
  '干预使议题集中，但发言量未减少': 'The intervention focused the issue without reducing participation',
  '发言总量': 'Total posts',
  '争论主张': 'Contested claims',
  '群体信任度': 'Group trust',
  '官方渠道将分散的负面表达聚合为对责任与时限的直接质询。': 'Official channels consolidated scattered negative reactions into direct questions about accountability and timelines.',
  'CASE 02 · 资源争议': 'CASE 02 · RESOURCE DISPUTE',
  '服务闭环有效，不等于信任已恢复': 'An effective service loop does not mean trust has recovered',
  '工单将服务积压降至零，但在实质资源不足时，程序公开也可能引发新的质询。': 'Tickets reduced the service backlog to zero, but procedural transparency can still prompt new questions when resources remain scarce.',
  'KEY FINDING · 核心发现': 'KEY FINDING',
  '“服务承接有效”，不等于“程序正当性与群体信任已建立”。': 'Effective service delivery does not mean procedural legitimacy and group trust have been established.',
  '综合干预将资源争议的服务积压降至 0，但群体信任度从 Natural 的 0.429 下降至 0.375。': 'The combined intervention reduced the resource-dispute service backlog to 0, while group trust fell from 0.429 under Natural to 0.375.',
  '证据口径与适用边界': 'Evidence definitions and scope of use',
  '评测结果用于说明特定设定下的模型表现，不是真实全校人群的统计替代。': 'Evaluation results describe model behavior under specific settings; they are not a statistical substitute for the real campus population.',
  '合成 Agent 表达社会动力属性，不对应现实学生或现实人际关系。': 'Synthetic Agents represent social-dynamic attributes and do not correspond to real students or relationships.',
  '极端热点长尾仍有差距：模拟/真实 P99 回复数为 11/33，最大回复数为 15/590。': 'The extreme long tail still differs: simulated/real P99 reply counts are 11/33, with maxima of 15/590.',
  '报告中“有回复帖子占比差”与“群体信息差”存在不同表格口径，未经证据版本核对前不做跨表直接比较。': 'The report uses different table definitions for reply-rate gaps and group-information gaps; do not compare them across tables without verifying the evidence version.',
  '所有结论受初始条件、数据覆盖、随机种子、策略定义与发布门禁约束。': 'All conclusions are bounded by initial conditions, data coverage, random seeds, policy definitions, and publication gates.',
  '查看证据目录': 'View evidence catalog',
  '查看架构与数据边界': 'View architecture and data boundaries',
  '进入案例中心查看完整分支证据': 'Open the Case Center to review complete branch evidence',
  '面包屑': 'Breadcrumbs',
  '系统规模': 'System scale',
})

const STORAGE_KEY = 'campus-pulse-locale-v1'
const catalog = Object.freeze({
  ...((catalogDocument as { translations?: Record<string, string> }).translations || {}),
  ...supplementalTranslations,
})
const locale = ref<CampusPulseLocale>(
  typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'en-US'
    ? 'en-US'
    : 'zh-CN',
)

const phraseTranslations: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ['在政策发布前，', 'Before policy goes live,'],
  ['先看见舆论如何发生。', 'see how public opinion takes shape.'],
  ['把校园事件放进一个可审计的平行论坛：异质 LLM Agent 阅读同一热榜、形成不同解释、互相回复与求助；治理主体依据有限信息行动，系统实时呈现论坛如何分叉。', 'Place a campus event inside an auditable parallel forum. Diverse LLM Agents read the same leaderboard, form different interpretations, reply to one another, and ask for help. Governance actors act on limited information while the system shows, tick by tick, how the forums diverge.'],
  ['平台关键能力', 'Core platform capabilities'],
  ['持久 Agent', 'persistent Agents'], ['微角色', 'micro roles'], ['单步 LLM 预算', 'LLM budget per tick'],
  ['创建模拟项目', 'Create simulation'], ['观看演化', 'Watch evolution'],
  ['模型与 API', 'Model & API'], ['配置 API Key、Base URL 与模型', 'Configure API Key, Base URL, and model'],
  ['运行详情', 'Run details'],
  ['先创建一个事件场景', 'Create an event scenario first'],
  ['“冻结情景”只显示这个项目已经创建并封存的场景。当前项目还没有场景，因此下拉列表为空。', 'Frozen scenario only lists scenarios already created and sealed for this project. This project does not have one yet, so the selector is empty.'],
  ['前往事件场景', 'Open event scenarios'], ['尚未创建情景', 'No scenario created'],
  ['先初始化运行场景', 'Initialize the simulation setup'],
  ['这个项目尚未绑定运行所需的审阅场景、治理方案与人口。点击初始化后，“冻结情景”即可选择。', 'This project has not initialized its reviewed scenarios, governance options, and agent population. Initialize it to enable the scenario selector.'],
  ['初始化场景与治理方案', 'Initialize scenarios and policies'], ['初始化中…', 'Initializing…'],
  ['手动创建场景', 'Create scenario manually'], ['场景、治理方案与人口已就绪。', 'Scenarios, policies, and agent population are ready.'],
  ['模型调用配置', 'Model connection'], ['配置模型与 API', 'Configure model & API'],
  ['在运行前填写 API Key、Base URL、模型名、并发、超时与推理模式。', 'Before running, enter the API Key, Base URL, model, concurrency, timeout, and reasoning mode.'],
  ['实时演示正在推进', 'Live demo running'], ['实时演示已暂停', 'Live demo paused'],
  ['单场景、单固定随机种子、Tick 3–10 的真实 LLM 治理预演。', 'Single-scenario, single fixed seed, verified live-LLM governance rehearsal for Tick 3–10.'],
  ['不代表现实政策因果效果、全校民意或正式治理建议。', 'It does not represent real-world causal effects, campus-wide opinion, or formal governance advice.'],
  ['每个 Agent 每时点最多生成一条语言内容，但点赞、静默转发和举报是独立多选；因此可以在评论的同时点赞、转发或举报多个已读消息。热榜使用当时已经发生的评论、参与者、点赞、转发和时效性，举报只进入风控、不抬高热度。历史案例未采集的点赞保持“未采集”，不会补造数字。', 'Each Agent can produce at most one language action per tick, while likes, silent reposts, and reports are independent multi-select interactions. An Agent may therefore comment while also liking, reposting, or reporting multiple read messages. The leaderboard uses observed replies, participants, likes, reposts, and recency; reports enter risk control without boosting popularity. If a historical case did not collect likes, it remains marked as not collected rather than being fabricated.'],
  ['当前还没有已发布的讨论串。', 'No published threads yet.'],
  ['本时点无新帖，显示最近', 'No new posts at this tick; showing the latest'],
  ['暂无可展示的公开消息。', 'No public messages available.'],
  ['选择模拟时点，当前', 'Select simulation tick, current'],
  ['选择模拟时间步，当前', 'Select simulation tick, current'],
  ['正在加载', 'Loading'], ['正在校验', 'Verifying'], ['正在检查', 'Checking'],
  ['正在创建', 'Creating'], ['正在演化', 'Evolving'], ['已暂停', 'Paused'],
  ['实时演示', 'Live demo'], ['事件爆发', 'Event burst'], ['讨论扩散', 'Discussion spread'],
  ['回落沉淀', 'Decay'], ['基线期', 'Baseline'], ['主动治理', 'Active governance'],
  ['自然演化', 'Natural evolution'], ['只解释 A', 'Explanation only A'],
  ['通州校区治理信息冲击', 'Tongzhou Campus governance-information shock'],
  ['讲座争议外生事件', 'Lecture-controversy exogenous event'],
  ['组合治理', 'Combined governance'], ['个可用方案', 'available policies'],
  ['上次同步', 'Last synced'], ['当前显示', 'showing'], ['当轮共', 'This tick'],
  ['展开全部', 'Show all'], ['条动态', 'updates'], ['条', ''], ['个项目', 'projects'],
  ['个种子', 'seeds'], ['个合成 LLM Agent', 'synthetic LLM Agents'],
  ['分支讨论串', ' branch threads'], ['累计消息', 'Messages'], ['讨论串', 'Threads'], ['参与者', 'participants'],
  ['后续回复', 'follow-up replies'], ['整串评论', 'thread replies'], ['支持性回复', 'supportive replies'],
  ['直接回复', 'direct replies'], ['回复 ', 'Reply to '], ['点赞', 'likes'], ['转发', 'reposts'], ['举报', 'reports'],
  ['引用', 'quotes'], ['消息', 'messages'],
  ['风险上报', 'risk reports'], ['服务回执', 'service receipt'], ['治理消息', 'governance message'],
  ['未采集', 'not collected'], ['不可用', 'unavailable'], ['只读', 'read-only'],
  ['已验证', 'verified'], ['未验证', 'unverified'], ['重试', 'Retry'], ['关闭', 'Close'],
  ['实时动态', ' live feed'], ['热榜', ' leaderboard'], ['新发布', 'new posts'],
  ['互动口径', 'Interaction model'], ['趋势数据表', 'trend data table'], ['按 Enter 打开结果', 'press Enter to open results'],
  ['选择', 'Select'], ['基线', 'baseline'], ['爆发', 'burst'], ['扩散', 'spread'],
  ['查看', 'View '], ['返回', 'Back'], ['取消', 'Cancel'], ['保存', 'Save'], ['刷新', 'Refresh'],
  ['当前不可入队', 'Not queueable'], ['不允许 Provider 调用', 'Provider calls not allowed'],
  ['不可入队', 'Not queueable'],
  ['SHA-256 匹配', 'SHA-256 match'], ['schema 为', 'schema:'],
  ['就绪', 'ready'], ['阻断', 'blocked'], ['未知', 'unknown'],
  ['已安装', 'installed'],
  ['（', ' ('], ['）', ')'], ['，', ', '], ['；', '; '], ['：', ': '],
])

export const currentLocale = computed(() => locale.value)
export const isEnglish = computed(() => locale.value === 'en-US')

export function setLocale(value: CampusPulseLocale): void {
  locale.value = value
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, value)
}

export function toggleLocale(): void {
  setLocale(locale.value === 'zh-CN' ? 'en-US' : 'zh-CN')
}

export function translateInterfaceText(value: string): string {
  if (locale.value !== 'en-US' || !/[\u3400-\u9fff]/.test(value)) return value
  const normalized = value.replace(/\s+/g, ' ').trim()
  const exact = catalog[normalized]
  if (exact) return exact
  let translated = normalized
  for (const [source, target] of phraseTranslations) translated = translated.replaceAll(source, target)
  return translated
}

const originalText = new WeakMap<Text, string>()
const originalAttributes = new WeakMap<Element, Map<string, string>>()
const translatedAttributes = ['aria-label', 'title', 'placeholder', 'data-label']

function isContentText(node: Node): boolean {
  const parent = node.parentElement
  return Boolean(parent && parent.closest('[data-content-language="zh"], [data-no-localize]'))
}

function translateTextNode(node: Text): void {
  if (isContentText(node)) return
  const current = node.data
  const previousOriginal = originalText.get(node)
  if (locale.value === 'zh-CN') {
    if (previousOriginal !== undefined && current !== previousOriginal) node.data = previousOriginal
    return
  }
  if (!/[\u3400-\u9fff]/.test(current)) {
    if (previousOriginal !== undefined && current === translateInterfaceText(previousOriginal)) return
    return
  }
  const original = current
  originalText.set(node, original)
  const leading = original.match(/^\s*/)?.[0] || ''
  const trailing = original.match(/\s*$/)?.[0] || ''
  const translated = translateInterfaceText(original.trim())
  if (translated !== original.trim()) node.data = `${leading}${translated}${trailing}`
}

function translateElementAttributes(element: Element): void {
  if (element.closest('[data-content-language="zh"], [data-no-localize]')) return
  let originals = originalAttributes.get(element)
  if (!originals) {
    originals = new Map()
    originalAttributes.set(element, originals)
  }
  for (const name of translatedAttributes) {
    const current = element.getAttribute(name)
    if (current === null) continue
    const original = originals.get(name)
    if (locale.value === 'zh-CN') {
      if (original !== undefined && current !== original) element.setAttribute(name, original)
      continue
    }
    if (!/[\u3400-\u9fff]/.test(current)) continue
    originals.set(name, current)
    const translated = translateInterfaceText(current)
    if (translated !== current) element.setAttribute(name, translated)
  }
}

function translateTree(root: HTMLElement): void {
  translateElementAttributes(root)
  root.querySelectorAll('*').forEach(translateElementAttributes)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    translateTextNode(current as Text)
    current = walker.nextNode()
  }
}

/** Localize the existing product DOM without forcing every legacy view to
 * adopt a second rendering system.  Synthetic forum text is explicitly
 * excluded and remains behind its per-message translation control. */
export function useCampusPulseDomLocalization(root: Ref<HTMLElement | null>): void {
  let observer: MutationObserver | null = null
  let portalObserver: MutationObserver | null = null
  let applying = false
  const portals = () => [...document.querySelectorAll<HTMLElement>('.campus-pulse-portal')]
  const apply = async () => {
    await nextTick()
    if (!root.value) return
    applying = true
    translateTree(root.value)
    portals().forEach(translateTree)
    document.documentElement.lang = locale.value
    applying = false
  }
  onMounted(() => {
    apply()
    observer = new MutationObserver((mutations) => {
      if (applying) return
      applying = true
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') translateTextNode(mutation.target as Text)
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text)
          else if (node instanceof HTMLElement) translateTree(node)
        })
        if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          translateElementAttributes(mutation.target)
        }
      }
      applying = false
    })
    observer.observe(root.value!, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: translatedAttributes })
    portalObserver = new MutationObserver((mutations) => {
      if (applying) return
      applying = true
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return
          if (node.matches('.campus-pulse-portal')) translateTree(node)
          node.querySelectorAll<HTMLElement>('.campus-pulse-portal').forEach(translateTree)
        })
      }
      applying = false
    })
    portalObserver.observe(document.body, { subtree: true, childList: true })
  })
  watch(locale, apply)
  onBeforeUnmount(() => {
    observer?.disconnect()
    portalObserver?.disconnect()
  })
}
