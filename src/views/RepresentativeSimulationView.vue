<template>
  <div class="sim-shell">
    <header class="topbar">
      <router-link class="back-link" to="/">
        <span aria-hidden="true">←</span>
        YuLan-OneSim
      </router-link>
      <div class="brand">
        <span class="brand-mark">脉</span>
        <div>
          <strong>CampusPulse</strong>
          <small>代表人群治理推演台</small>
        </div>
      </div>
      <div v-if="demo" class="snapshot">
        <i></i>
        证据快照 {{ demo.meta.datasetSnapshot }}
      </div>
    </header>

    <main v-if="demo && scenario" class="page">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">DATA-GROUNDED SOCIAL SIMULATION</p>
          <h1>不是预测舆情，<br><em>是提前看见谁会被什么问题留下。</em></h1>
          <p class="hero-intro">
            用两张校园论坛表建立可观察行为人群，让48个大模型智能体在同一冲击下作出不同选择；
            治理方案的价值，不是让所有人闭嘴，而是解释谁会更新、谁还需要什么。
          </p>
          <div class="hero-actions">
            <button type="button" class="primary-action" @click="scrollTo('simulation')">
              播放四阶段推演
              <span aria-hidden="true">↓</span>
            </button>
            <button type="button" class="text-action" @click="scrollTo('evidence')">查看可信边界</button>
            <router-link class="text-action workbench-action" to="/campus-pulse/governance-arena-v2">
              千体混合 Arena v2 ↗
            </router-link>
            <router-link class="text-action workbench-action" to="/campus-pulse/workbench">
              进入治理工作台 ↗
            </router-link>
          </div>
        </div>

        <aside class="hero-console" aria-label="选择推演场景">
          <div class="console-head">
            <span>选择冲击</span>
            <small>同一人口 · 不同机制</small>
          </div>
          <button
            v-for="option in scenarioOptions"
            :key="option.id"
            type="button"
            class="scenario-option"
            :class="{ active: scenarioId === option.id }"
            :aria-pressed="scenarioId === option.id"
            @click="selectScenario(option.id)"
          >
            <span class="scenario-number">{{ option.number }}</span>
            <span>
              <strong>{{ demo.scenarios[option.id].short }}</strong>
              <small>{{ demo.scenarios[option.id].origin }}</small>
            </span>
            <i aria-hidden="true">↗</i>
          </button>
          <div class="console-result">
            <span>当前结论</span>
            <strong>{{ scenario.origin === '治理行动' ? '爆发期达到峰值' : '扩散期达到峰值' }}</strong>
            <small>两个随机种子均保持该阶段结构</small>
          </div>
        </aside>
      </section>

      <section class="metric-rail" aria-label="模型证据摘要">
        <article>
          <span>输入</span>
          <strong>{{ demo.meta.sourceTables }}</strong>
          <small>张授权论坛表</small>
        </article>
        <i class="rail-arrow">→</i>
        <article>
          <span>理解</span>
          <strong>{{ demo.meta.semanticCards.toLocaleString() }}</strong>
          <small>条跨时点语义卡</small>
        </article>
        <i class="rail-arrow">→</i>
        <article>
          <span>人群</span>
          <strong>{{ demo.meta.personaVariants }}</strong>
          <small>个经审阅画像变体</small>
        </article>
        <i class="rail-arrow">→</i>
        <article>
          <span>仿真</span>
          <strong>{{ demo.meta.agents }}</strong>
          <small>个加权大模型智能体</small>
        </article>
        <i class="rail-arrow">→</i>
        <article class="reviewed-metric">
          <span>人工语义验收</span>
          <strong>{{ demo.meta.reviewedDecisions }}</strong>
          <small>个决策逐条阅读</small>
        </article>
      </section>

      <section id="population" class="section population-section">
        <div class="section-heading">
          <div>
            <p class="kicker">01 / REPRESENTATIVE POPULATION</p>
            <h2>48个点，不是48个“平均学生”</h2>
          </div>
          <p>
            每个点都来自当月论坛行为权重；点开任一人群，可以看到同一原型内部的表达变体。
            不使用性别、年级、专业或真实身份。
          </p>
        </div>

        <div class="population-workspace">
          <div class="agent-map-card">
            <div class="map-header">
              <div>
                <span>2026年3月代表性人口</span>
                <strong>48 AGENTS</strong>
              </div>
              <div class="live-state"><i></i> 已冻结人口快照</div>
            </div>
            <div class="agent-map" role="list" aria-label="48个代表智能体">
              <button
                v-for="dot in agentDots"
                :key="dot.key"
                type="button"
                class="agent-dot"
                :class="[`domain-${dot.domain}`, { selected: selectedArchetypeId === dot.archetypeId }]"
                :title="`${dot.agentLabel} · ${dot.label}`"
                :aria-label="`${dot.agentLabel}，${dot.label}`"
                @click="selectedArchetypeId = dot.archetypeId"
              >
                <span>{{ dot.shortIndex }}</span>
              </button>
            </div>
            <div class="domain-legend">
              <span v-for="item in domainLegend" :key="item.id">
                <i :class="`domain-${item.id}`"></i>{{ item.label }}
              </span>
            </div>
          </div>

          <aside v-if="selectedArchetype" class="persona-card">
            <div class="persona-index">{{ selectedArchetype.id.replace('archetype-', 'A') }}</div>
            <p>当前选中原型</p>
            <h3>{{ selectedArchetype.label }}</h3>
            <div class="persona-weight">
              <div>
                <span>配置人数</span>
                <strong>{{ selectedArchetype.count }}</strong>
              </div>
              <div>
                <span>论坛行为权重</span>
                <strong>{{ percent(selectedArchetype.weight) }}</strong>
              </div>
            </div>
            <div class="variant-list">
              <span>同类内部变体</span>
              <span v-for="variant in selectedArchetype.variants" :key="variant" class="variant-chip">
                {{ variant }}
              </span>
            </div>
            <p class="persona-note">
              共享的是信息门槛和行为倾向，不共享固定故事或标准话术。
            </p>
          </aside>

          <div class="archetype-list" aria-label="全部人群原型">
            <button
              v-for="archetype in demo.population.archetypes"
              :key="archetype.id"
              type="button"
              :class="{ active: selectedArchetypeId === archetype.id }"
              @click="selectedArchetypeId = archetype.id"
            >
              <i :class="`domain-${archetype.domain}`"></i>
              <span>{{ archetype.label }}</span>
              <small>{{ archetype.count }}人</small>
            </button>
            <div class="background-mass">
              <span>另保留 {{ percent(demo.population.backgroundWeight) }} 背景质量</span>
              <small>{{ demo.population.backgroundLabel }}不生成自主智能体</small>
            </div>
          </div>
        </div>

        <article v-if="currentFidelityCase" class="fidelity-lab" aria-labelledby="fidelity-title">
          <header class="fidelity-lab-header">
            <div>
              <span>PERSONA TRANSFER AUDIT</span>
              <h3 id="fidelity-title">先承认漂移，再证明修复真的有效</h3>
              <p>历史审阅与新版门控验收分层呈现；跨月只比较冻结画像变体，同月共享基线内才比较同一智能体的政策分支。</p>
            </div>
            <dl class="fidelity-scoreboard">
              <div><dt>共同变体</dt><dd>{{ demo.crossShockFidelity.summary.commonVariants }}</dd></div>
              <div><dt>历史审阅</dt><dd>{{ demo.crossShockFidelity.summary.reviewedVariants }}</dd></div>
              <div class="score-clear"><dt>历史清晰</dt><dd>{{ demo.crossShockFidelity.summary.clear }}</dd></div>
              <div class="score-partial"><dt>历史部分</dt><dd>{{ demo.crossShockFidelity.summary.partial }}</dd></div>
            </dl>
          </header>

          <section class="gate-acceptance-strip" aria-label="变体相关性门控验收摘要">
            <div>
              <span>VARIANT GATE ACCEPTANCE</span>
              <strong>
                新版冻结面板
                {{ demo.crossShockFidelity.gateAcceptance.summary.clear }}/{{ demo.crossShockFidelity.gateAcceptance.summary.variants }}
                清晰通过
              </strong>
              <p>
                人工逐条阅读 {{ demo.crossShockFidelity.gateAcceptance.summary.decisionsRead }} 个决策、
                {{ demo.crossShockFidelity.gateAcceptance.summary.publicMessagesRead }} 条公开发言；旧版唯一漂移已进入针对性回归验收。
              </p>
            </div>
            <dl>
              <div>
                <dt>直接触发</dt>
                <dd>{{ demo.crossShockFidelity.gateAcceptance.routeAudit.directPublic }}/{{ demo.crossShockFidelity.gateAcceptance.routeAudit.directPublic }} 公开</dd>
              </div>
              <div>
                <dt>无关冲击</dt>
                <dd>{{ demo.crossShockFidelity.gateAcceptance.routeAudit.irrelevantNonPublic }}/{{ demo.crossShockFidelity.gateAcceptance.routeAudit.irrelevantNonPublic }} 非公开</dd>
              </div>
              <div>
                <dt>错误追热点</dt>
                <dd>{{ demo.crossShockFidelity.gateAcceptance.summary.irrelevantPublicViolations }}</dd>
              </div>
            </dl>
          </section>

          <div class="fidelity-tabs" role="tablist" aria-label="选择人物机制迁移案例">
            <button
              v-for="item in demo.crossShockFidelity.cases"
              :key="item.id"
              type="button"
              role="tab"
              :aria-selected="fidelityCaseId === item.id"
              :class="{ active: fidelityCaseId === item.id }"
              @click="fidelityCaseId = item.id"
            >
              <span>{{ item.variant }}</span>
              <small v-if="item.repair" class="tab-rating-update">
                <s>{{ item.ratingLabel }}</s>
                <em>{{ item.repair.ratingLabel }}</em>
              </small>
              <small v-else>{{ item.ratingLabel }}</small>
            </button>
          </div>

          <div
            class="fidelity-case"
            :class="[`rating-${currentFidelityCase.rating}`, { 'has-gate-repair': currentFidelityCase.repair }]"
          >
            <header>
              <div>
                <span>{{ currentFidelityCase.variantId }}</span>
                <strong>{{ currentFidelityCase.archetype }}</strong>
                <small>{{ currentFidelityCase.variant }}</small>
              </div>
              <div class="fidelity-rating">
                <small v-if="currentFidelityCase.repair">历史：{{ currentFidelityCase.ratingLabel }}</small>
                <b>{{ currentFidelityCase.repair?.ratingLabel || currentFidelityCase.ratingLabel }}</b>
              </div>
            </header>

            <template v-if="currentFidelityCase.repair">
              <div class="fidelity-claim repaired-claim">
                <strong>{{ currentFidelityCase.repair.headline }}</strong>
                <p>旧版结果保留在左侧作为失败证据；新版结果来自独立的四变体 × 两冲击 × 四阶段验收面板。</p>
              </div>
              <div class="gate-repair-flow">
                <section class="repair-card old-drift-card">
                  <header>
                    <span>01 / {{ currentFidelityCase.repair.oldDrift.label }}</span>
                    <small>历史审阅</small>
                  </header>
                  <b>{{ currentFidelityCase.repair.oldDrift.phase }}</b>
                  <p>“{{ currentFidelityCase.repair.oldDrift.text }}”</p>
                  <footer>{{ currentFidelityCase.repair.oldDrift.route }}</footer>
                </section>
                <i>→</i>
                <section class="repair-card gate-rule-card">
                  <header>
                    <span>02 / {{ currentFidelityCase.repair.gate.label }}</span>
                    <small>先判相关，再生成</small>
                  </header>
                  <b>精确到画像变体与行动时域</b>
                  <p>{{ currentFidelityCase.repair.gate.rule }}</p>
                  <footer>{{ currentFidelityCase.repair.gate.decision }}</footer>
                </section>
                <i>→</i>
                <section class="repair-card updated-route-card">
                  <header>
                    <span>03 / 新版双冲击轨迹</span>
                    <small>同一变体，不同激活</small>
                  </header>
                  <div class="updated-route">
                    <div>
                      <b>{{ currentFidelityCase.repair.updatedLecture.label }}</b>
                      <small>AGENT {{ currentFidelityCase.repair.updatedLecture.agent }} · {{ currentFidelityCase.repair.updatedLecture.timeline }}</small>
                      <p>{{ currentFidelityCase.repair.updatedLecture.text }}</p>
                      <em>{{ currentFidelityCase.repair.updatedLecture.route }}</em>
                    </div>
                    <div>
                      <b>{{ currentFidelityCase.repair.updatedTongzhou.label }}</b>
                      <small>AGENT {{ currentFidelityCase.repair.updatedTongzhou.agent }} · {{ currentFidelityCase.repair.updatedTongzhou.timeline }}</small>
                      <p v-for="message in currentFidelityCase.repair.updatedTongzhou.messages" :key="message">“{{ message }}”</p>
                      <em>{{ currentFidelityCase.repair.updatedTongzhou.route }}</em>
                    </div>
                  </div>
                </section>
              </div>
            </template>

            <template v-else>
              <div class="fidelity-claim">
                <strong>{{ currentFidelityCase.headline }}</strong>
                <p>{{ currentFidelityCase.invariant }}</p>
              </div>
              <div class="fidelity-trajectories">
                <section class="trajectory-card lecture-trajectory">
                  <header>
                    <span>{{ currentFidelityCase.lecture.month }} · 讲座外生冲击</span>
                    <small>AGENT {{ currentFidelityCase.lecture.agent }}</small>
                  </header>
                  <b>{{ currentFidelityCase.lecture.phase }}</b>
                  <p>{{ currentFidelityCase.lecture.text }}</p>
                  <footer>{{ currentFidelityCase.lecture.action }}</footer>
                </section>
                <i>→</i>
                <section class="trajectory-card natural-trajectory">
                  <header>
                    <span>{{ currentFidelityCase.tongzhouNatural.month }} · 通州冲击</span>
                    <small>AGENT {{ currentFidelityCase.tongzhouNatural.agent }}</small>
                  </header>
                  <b>{{ currentFidelityCase.tongzhouNatural.phase }}</b>
                  <p>{{ currentFidelityCase.tongzhouNatural.text }}</p>
                  <footer>{{ currentFidelityCase.tongzhouNatural.action }}</footer>
                </section>
                <i>→</i>
                <section class="trajectory-card combined-trajectory">
                  <header>
                    <span>{{ currentFidelityCase.tongzhouCombined.month }} · 同人政策分支</span>
                    <small>AGENT {{ currentFidelityCase.tongzhouCombined.agent }}</small>
                  </header>
                  <b>{{ currentFidelityCase.tongzhouCombined.phase }}</b>
                  <p>{{ currentFidelityCase.tongzhouCombined.text }}</p>
                  <footer>{{ currentFidelityCase.tongzhouCombined.action }}</footer>
                </section>
              </div>
            </template>
          </div>

          <footer class="fidelity-boundary">
            <strong>证据边界</strong>
            <span>{{ demo.crossShockFidelity.gateAcceptance.boundary }}</span>
            <small>
              历史 {{ demo.crossShockFidelity.summary.messagesRead }} 条发言 +
              新版 {{ demo.crossShockFidelity.gateAcceptance.summary.decisionsRead }} 个决策
            </small>
          </footer>
        </article>
      </section>

      <section id="simulation" class="section simulation-section">
        <div class="section-heading simulation-heading">
          <div>
            <p class="kicker">02 / FOUR-STAGE REPLAY</p>
            <h2>{{ scenario.title }}</h2>
          </div>
          <div class="event-caption">
            <span>{{ scenario.origin }}</span>
            <p>{{ scenario.description }}</p>
          </div>
        </div>

        <div class="phase-navigator" role="tablist" aria-label="选择仿真阶段">
          <button
            v-for="(phase, key, index) in scenario.phaseData"
            :key="key"
            type="button"
            role="tab"
            :aria-selected="phaseId === key"
            :class="{ active: phaseId === key }"
            @click="selectPhase(key)"
          >
            <span>0{{ index + 1 }}</span>
            <strong>{{ phase.label }}</strong>
            <small>{{ phase.window }}</small>
            <i class="phase-bar">
              <b :style="{ width: `${(phase.relevant[0] / 48) * 100}%` }"></b>
            </i>
          </button>
          <button type="button" class="play-button" :class="{ playing }" @click="togglePlayback">
            <span aria-hidden="true">{{ playing ? 'Ⅱ' : '▶' }}</span>
            {{ playing ? '暂停' : '自动播放' }}
          </button>
        </div>

        <div class="simulation-grid">
          <article class="phase-card">
            <div class="phase-card-top">
              <div>
                <span>阶段 {{ phaseIndex + 1 }} / 4</span>
                <h3>{{ currentPhase.label }}</h3>
                <small>{{ currentPhase.window }}</small>
              </div>
              <div class="phase-pulse" :class="`pulse-${phaseId}`">
                <i></i><i></i><i></i>
              </div>
            </div>
            <p class="phase-story">{{ currentPhase.story }}</p>

            <div class="seed-comparison">
              <div v-for="(count, index) in currentPhase.relevant" :key="index">
                <span>随机种子 {{ index + 1 }}</span>
                <strong>{{ count }}<small>/48 事件相关发言</small></strong>
                <i><b :style="{ width: `${(count / 48) * 100}%` }"></b></i>
              </div>
            </div>

            <div class="phase-kpis">
              <div>
                <span>公开行动</span>
                <strong>{{ currentMetrics.public }}</strong>
              </div>
              <div>
                <span>事件相关</span>
                <strong>{{ currentMetrics.relevant }}</strong>
              </div>
              <div>
                <span>模拟信任</span>
                <strong>{{ currentMetrics.trust.toFixed(2) }}</strong>
              </div>
              <div>
                <span>模拟满意权重</span>
                <strong>{{ percent(currentMetrics.satisfied) }}</strong>
              </div>
            </div>

            <div class="topic-mix">
              <div class="subhead">
                <span>议题结构</span>
                <small>当前种子 · 48智能体决策</small>
              </div>
              <div v-for="topic in currentPhase.topics" :key="topic.label" class="topic-row">
                <span>{{ topic.label }}</span>
                <i><b :style="{ width: `${(topic.value / maxTopicValue) * 100}%` }"></b></i>
                <strong>{{ topic.value }}</strong>
              </div>
            </div>
          </article>

          <article class="transcript-card">
            <div class="transcript-head">
              <div>
                <p>逐条审阅的合成发言</p>
                <h3>这一时点，典型人群在说什么？</h3>
              </div>
              <div v-if="scenarioId === 'tongzhou'" class="policy-switch" role="group" aria-label="选择治理分支">
                <button
                  v-for="(policy, key) in scenario.policies"
                  :key="key"
                  type="button"
                  :class="{ active: policyId === key }"
                  :aria-pressed="policyId === key"
                  @click="policyId = key"
                >{{ policy.label }}</button>
              </div>
            </div>

            <div class="policy-context">
              <i :class="policyId === 'combined' ? 'policy-on' : ''"></i>
              <span>{{ currentPolicy.description }}</span>
            </div>

            <TransitionGroup name="message" tag="div" class="message-feed">
              <article v-for="message in currentMessages" :key="`${scenarioId}-${policyId}-${phaseId}-${message.agent}-${message.text}`" class="message-item">
                <div class="agent-avatar" :class="`stance-${message.stance}`">{{ message.agent }}</div>
                <div>
                  <header>
                    <strong>{{ message.archetype }}</strong>
                    <span>{{ message.variant }}</span>
                    <small>{{ stanceLabel(message.stance) }}</small>
                  </header>
                  <p>{{ message.text }}</p>
                </div>
              </article>
            </TransitionGroup>
            <p v-if="currentMessages.length === 0" class="empty-transcript">该分支在当前阶段复用共同基线。</p>
            <footer>
              <span>仅展示代表性摘录</span>
              <span>完整验收共 {{ demo.meta.reviewedPublicMessages }} 条公开发言</span>
            </footer>
          </article>
        </div>

        <div class="shape-proof">
          <div>
            <p>双种子阶段复现</p>
            <h3>峰值阶段一致，文本轨迹不复制</h3>
          </div>
          <div class="shape-chart" role="img" :aria-label="`${scenario.title}两个随机种子的阶段相关发言对比`">
            <div v-for="(phase, key) in scenario.phaseData" :key="key" class="shape-column">
              <div class="shape-bars">
                <i :style="{ height: `${Math.max(3, (phase.relevant[0] / 48) * 100)}%` }"></i>
                <i :style="{ height: `${Math.max(3, (phase.relevant[1] / 48) * 100)}%` }"></i>
              </div>
              <span>{{ phase.label }}</span>
            </div>
          </div>
          <dl>
            <div><dt>历史峰值</dt><dd>{{ phaseLabel(scenario.observedPeak) }}</dd></div>
            <div><dt>仿真峰值</dt><dd>{{ phaseLabel(scenario.simulatedPeak) }}</dd></div>
            <div><dt>两种子 MAE</dt><dd>{{ scenario.mae[0].toFixed(3) }} / {{ scenario.mae[1].toFixed(3) }}</dd></div>
          </dl>
        </div>
      </section>

      <section v-if="demo.expressionPilot" id="expression" class="section expression-section">
        <div class="section-heading">
          <div>
            <p class="kicker">03 / AUDITABLE EXPRESSION</p>
            <h2>同一个人先决定“说什么”，再决定“怎么说”</h2>
          </div>
          <p>
            行为底稿保持不变，表达层只把它渲染成主帖或承接上文的短回复；
            新增事实、照抄原文或语义漂移都会触发自动回退。
          </p>
        </div>

        <div class="expression-proof">
          <article>
            <span>直接阅读</span>
            <strong>{{ demo.expressionPilot.caseCount }}</strong>
            <small>条双冲击小样本</small>
          </article>
          <i>→</i>
          <article>
            <span>回复中位长度</span>
            <strong>{{ demo.expressionPilot.replyMedianBefore }}<b>字</b></strong>
            <small>第一轮：仍像完整小作文</small>
          </article>
          <i>→</i>
          <article class="proof-active">
            <span>第三轮</span>
            <strong>{{ demo.expressionPilot.replyMedianAfter }}<b>字</b></strong>
            <small>真实全库中位数 {{ demo.expressionPilot.realReplyMedian }} 字</small>
          </article>
          <i>→</i>
          <article>
            <span>16字原文重合</span>
            <strong>{{ demo.expressionPilot.rawOverlap16Chars }}</strong>
            <small>全量两表审计</small>
          </article>
        </div>

        <div class="expression-grid">
          <article
            v-for="item in expressionCases"
            :key="`${item.scenario}-${item.archetype}-${item.forum}`"
            class="expression-card"
          >
            <header>
              <div>
                <span>{{ item.phase }} · {{ item.target }}</span>
                <strong>{{ item.archetype }}</strong>
              </div>
              <small>{{ item.variant }}</small>
            </header>
            <div v-if="item.parent" class="parent-context">
              <span>承接上文</span>
              <p>{{ item.parent }}</p>
            </div>
            <div class="expression-trace">
              <div class="ledger-copy">
                <span>可审计行为底稿</span>
                <p>{{ item.canonical }}</p>
              </div>
              <i aria-hidden="true">↘</i>
              <div class="forum-copy">
                <span>论坛表达</span>
                <p>{{ item.forum }}</p>
              </div>
            </div>
          </article>
        </div>

        <div class="expression-boundary">
          <strong>{{ demo.expressionPilot.heldOut }}</strong>
          <span>{{ demo.expressionPilot.limitations }}</span>
        </div>
      </section>

      <section v-if="demo.threadEcology" id="thread-ecology" class="section thread-ecology-section">
        <div class="section-heading">
          <div>
            <p class="kicker">04 / LOCAL THREAD ECOLOGY</p>
            <h2>回复不是独立小作文，而是在一条讨论里执行动作</h2>
          </div>
          <p>
            先从真实父帖—回复对中识别求证、转述、接梗和附和，再让独立路由器决定人物进入哪条线程、
            接根帖还是最新回复。讲座窗口只做留出检验，不参与生成。
          </p>
        </div>

        <div class="thread-proof">
          <article>
            <span>真实回复盲编码</span>
            <strong>{{ demo.threadEcology.referenceSample + demo.threadEcology.lectureHoldoutSample }}</strong>
            <small>每种子窗口外 / 留出各 {{ demo.threadEcology.referenceSample }} 条</small>
          </article>
          <article>
            <span>局部线程</span>
            <strong>{{ demo.threadEcology.threadCount }}</strong>
            <small>{{ demo.threadEcology.seedCount }} 种子 × 3 条根帖</small>
          </article>
          <article>
            <span>顺序回复</span>
            <strong>{{ demo.threadEcology.replyCount }}</strong>
            <small>语义路由后读取父帖与最近回复</small>
          </article>
          <article class="proof-active">
            <span>人工语义复核</span>
            <strong>{{ demo.threadEcology.clearCount }}<b>清晰</b></strong>
            <small>{{ demo.threadEcology.partialCount }} 条部分通过 · {{ demo.threadEcology.failCount }} 条回退</small>
          </article>
        </div>

        <div class="function-evidence">
          <header>
            <div>
              <span>OBSERVED FUNCTION EVIDENCE</span>
              <strong>四类重点互动在真实样本中都实际出现</strong>
            </div>
            <small>双种子独立 48 条样本的多标签出现率区间</small>
          </header>
          <div class="function-rate-grid">
            <article v-for="rate in demo.threadEcology.functions" :key="rate.id">
              <strong>{{ rate.label }}</strong>
              <div>
                <span>窗口外</span>
                <i><b :style="{ width: `${Math.max(4, (rate.reference / 35) * 100)}%` }"></b></i>
                <em>{{ rate.referenceRange }}</em>
              </div>
              <div>
                <span>讲座留出</span>
                <i><b class="holdout" :style="{ width: `${Math.max(4, (rate.holdout / 35) * 100)}%` }"></b></i>
                <em>{{ rate.holdoutRange }}</em>
              </div>
            </article>
          </div>
        </div>

        <div class="thread-grid">
          <article v-for="thread in demo.threadEcology.threads" :key="thread.id" class="thread-card">
            <header>
              <span>{{ thread.id.replace('lecture-thread-', 'THREAD 0') }}</span>
              <strong>{{ thread.label }}</strong>
            </header>
            <div class="thread-root">
              <span>根帖</span>
              <p>{{ thread.root }}</p>
            </div>
            <ol>
              <li v-for="(turn, index) in thread.turns" :key="`${thread.id}-${index}`">
                <i>{{ index + 1 }}</i>
                <div>
                  <header><strong>{{ turn.agent }}</strong><span>{{ turn.function }}</span></header>
                  <p>{{ turn.text }}</p>
                </div>
              </li>
            </ol>
          </article>
        </div>

        <div class="expression-boundary thread-boundary">
          <strong>{{ demo.threadEcology.heldOut }}</strong>
          <span>{{ demo.threadEcology.boundary }}</span>
        </div>
      </section>

      <section v-if="scenarioId === 'tongzhou'" class="section governance-section">
        <div class="section-heading">
          <div>
            <p class="kicker">05 / GOVERNANCE STRESS TEST</p>
            <h2>治理不是让论坛安静，而是让诉求变得可处理</h2>
          </div>
          <p>
            组合治理不会立刻降低公开发言量。它通过明确选择权、负责人和更新时间，
            让部分人获得行动依据，同时暴露仍未解决的制度细节。
          </p>
        </div>

        <article v-if="currentGovernanceCase" class="governance-branch-lab">
          <header class="branch-lab-head">
            <div>
              <span>SAME ROOT / POLICY BRANCH</span>
              <strong>同一个根帖，治理改变的是“下一问”</strong>
              <small>同一人物 · 同一扩散期 · 共享基线状态</small>
            </div>
            <div class="branch-case-switch" role="tablist" aria-label="选择同根帖治理对照">
              <button
                v-for="item in scenario.governanceBranchDemo.cases"
                :key="item.id"
                type="button"
                role="tab"
                :aria-selected="governanceCaseId === item.id"
                :class="{ active: governanceCaseId === item.id }"
                @click="governanceCaseId = item.id"
              >{{ item.label }}</button>
            </div>
          </header>

          <div class="branch-common-root">
            <span>共同根帖 · 爆发期 · AGENT {{ currentGovernanceCase.root.agent }}</span>
            <strong>{{ currentGovernanceCase.root.archetype }} · {{ currentGovernanceCase.root.variant }}</strong>
            <p>{{ currentGovernanceCase.root.text }}</p>
          </div>

          <div class="branch-actor-list">
            <article v-for="actor in currentGovernanceCase.actors" :key="actor.agent" class="branch-actor">
              <header>
                <div>
                  <span>AGENT {{ actor.agent }}</span>
                  <strong>{{ actor.archetype }}</strong>
                  <small>{{ actor.variant }}</small>
                </div>
                <p>{{ actor.interpretation }}</p>
              </header>
              <div class="branch-reaction-pair">
                <section class="branch-reaction baseline-reaction">
                  <header><span>自然演化</span><b>{{ signed(actor.baseline.trustDelta) }} 信任变化</b></header>
                  <p>{{ actor.baseline.text }}</p>
                  <small>{{ actor.baseline.satisfied ? '达到人物信息门槛' : '仍未达到人物信息门槛' }}</small>
                </section>
                <i>→</i>
                <section class="branch-reaction combined-reaction">
                  <header><span>组合治理</span><b>{{ signed(actor.combined.trustDelta) }} 信任变化</b></header>
                  <p>{{ actor.combined.text }}</p>
                  <small>{{ actor.combined.satisfied ? '达到人物信息门槛' : '仍未达到人物信息门槛' }}</small>
                </section>
              </div>
            </article>
          </div>

          <footer>
            <strong>解释边界</strong>
            <span>{{ scenario.governanceBranchDemo.boundary }}</span>
          </footer>
        </article>

        <article
          v-if="scenario.governanceOrchestration"
          class="orchestration-board"
          aria-labelledby="orchestration-title"
        >
          <header class="orchestration-head">
            <div>
              <span>MULTI-ACTOR ORCHESTRATION</span>
              <h3 id="orchestration-title">谁负责、何时做、凭什么触发</h3>
              <p>{{ scenario.governanceOrchestration.summary }}</p>
            </div>
            <strong>审阅模型程序 · 非现实执行</strong>
          </header>

          <dl class="orchestration-facts" aria-label="治理编排摘要">
            <div>
              <dt>责任角色</dt>
              <dd>{{ scenario.governanceOrchestration.actorCount }}</dd>
              <small>组织角色，不是智能体</small>
            </div>
            <div>
              <dt>受控动作</dt>
              <dd>{{ scenario.governanceOrchestration.actionCount }}</dd>
              <small>固定白名单</small>
            </div>
            <div>
              <dt>资源维度</dt>
              <dd>{{ scenario.governanceOrchestration.resourceUnitCount }}</dd>
              <small>全部为建模上限</small>
            </div>
            <div class="fact-zero">
              <dt>真实动作</dt>
              <dd>{{ scenario.governanceOrchestration.realWorldActions }}</dd>
              <small>不会直接发布或处置</small>
            </div>
          </dl>

          <div class="orchestration-layout">
            <ol class="orchestration-timeline" aria-label="治理动作时序">
              <li
                v-for="step in scenario.governanceOrchestration.steps"
                :key="step.id"
                :class="`orchestration-step step-${step.id}`"
              >
                <span class="step-index">{{ step.index }}</span>
                <div class="step-copy">
                  <header>
                    <span>{{ step.phase }}</span>
                    <b>{{ step.actor }}</b>
                  </header>
                  <h4>{{ step.action }}</h4>
                  <p>{{ step.mechanism }}</p>
                  <dl>
                    <div><dt>面向</dt><dd>{{ step.target }}</dd></div>
                    <div><dt>触发</dt><dd>{{ step.condition }}</dd></div>
                    <div><dt>资源</dt><dd>{{ step.resource }}</dd></div>
                  </dl>
                </div>
              </li>
            </ol>

            <aside class="orchestration-assurance" aria-label="可信比较与剩余缺口">
              <section class="comparison-contract">
                <header>
                  <span>COMPARISON CONTRACT</span>
                  <strong>先锁住可比性，再看分支差异</strong>
                </header>
                <dl>
                  <div
                    v-for="item in scenario.governanceOrchestration.comparisonContract"
                    :key="item.label"
                  >
                    <dt>{{ item.label }}</dt>
                    <dd>{{ item.value }}</dd>
                    <small>{{ item.note }}</small>
                  </div>
                </dl>
              </section>

              <section class="gap-register">
                <header>
                  <span>当前案例仍未解决</span>
                  <strong>{{ currentGovernanceCase?.label }}</strong>
                </header>
                <ul>
                  <li v-for="gap in currentGovernanceGaps" :key="gap">{{ gap }}</li>
                </ul>
                <p>{{ scenario.governanceOrchestration.cohortGap }}</p>
              </section>

              <section class="external-contrast">
                <span>{{ scenario.governanceOrchestration.externalContrast.label }}</span>
                <strong>{{ scenario.governanceOrchestration.externalContrast.title }}</strong>
                <p>{{ scenario.governanceOrchestration.externalContrast.note }}</p>
              </section>
            </aside>
          </div>

          <footer>
            <strong>解释边界</strong>
            <span>{{ scenario.governanceOrchestration.boundary }}</span>
          </footer>
        </article>

        <div class="governance-grid">
          <article class="policy-package">
            <header>
              <span>组合治理服务契约</span>
              <strong>4 ACTIONS</strong>
            </header>
            <ol>
              <li v-for="(item, index) in scenario.servicePackage" :key="item">
                <span>0{{ index + 1 }}</span>
                <p>{{ item }}</p>
              </li>
            </ol>
          </article>

          <article class="effect-card">
            <header>
              <span>扩散期 → 衰减期</span>
              <strong>模型条件下的群体更新</strong>
            </header>
            <div class="effect-comparison">
              <div>
                <span>自然演化</span>
                <strong>0%</strong>
                <small>衰减期满意权重</small>
              </div>
              <i>→</i>
              <div class="effect-positive">
                <span>组合治理</span>
                <strong>{{ percent(scenario.policies.combined.metrics.decay.satisfied) }}</strong>
                <small>衰减期满意权重</small>
              </div>
            </div>
            <div class="trust-change">
              <span>模拟信任</span>
              <i><b :style="{ width: `${scenario.policies.baseline.metrics.decay.trust * 100}%` }"></b></i>
              <strong>{{ scenario.policies.baseline.metrics.decay.trust.toFixed(2) }}</strong>
              <i><b class="after" :style="{ width: `${scenario.policies.combined.metrics.decay.trust * 100}%` }"></b></i>
              <strong>{{ scenario.policies.combined.metrics.decay.trust.toFixed(2) }}</strong>
            </div>
            <p>公开行动仍为24人：更新不等于沉默，也不等于问题已经解决。</p>
          </article>

          <article class="group-outcomes">
            <div class="outcome-column updated">
              <span>更可能获得行动依据</span>
              <strong v-for="group in scenario.updatedGroups" :key="group">{{ group }}</strong>
            </div>
            <div class="outcome-column unresolved">
              <span>仍会继续追问</span>
              <strong v-for="group in scenario.unresolvedGroups" :key="group">{{ group }}</strong>
            </div>
          </article>
        </div>
      </section>

      <section class="section transfer-section">
        <div class="section-heading">
          <div>
            <p class="kicker">06 / CROSS-SHOCK TRANSFER</p>
            <h2>同一套人群，没有把两个事件演成同一个故事</h2>
          </div>
          <p>治理公告是广泛直达；论坛外生争议需要先被少数人接触，再在扩散期成为公共议题。</p>
        </div>
        <div class="transfer-grid">
          <button
            v-for="option in scenarioOptions"
            :key="option.id"
            type="button"
            :class="{ active: scenarioId === option.id }"
            @click="selectScenario(option.id); scrollTo('simulation')"
          >
            <header>
              <span>{{ demo.scenarios[option.id].origin }}</span>
              <strong>{{ demo.scenarios[option.id].title }}</strong>
            </header>
            <div class="mini-shape">
              <div v-for="(phase, key) in demo.scenarios[option.id].phaseData" :key="key">
                <i :style="{ height: `${Math.max(4, (phase.relevant[0] / 48) * 100)}%` }"></i>
                <span>{{ phase.label }}</span>
              </div>
            </div>
            <footer>
              <span>早期事件相关发言 <b>{{ demo.scenarios[option.id].phaseData.burst.relevant[0] }}/48</b></span>
              <span>峰值 <b>{{ phaseLabel(demo.scenarios[option.id].simulatedPeak) }}</b></span>
            </footer>
          </button>
        </div>
      </section>

      <section id="evidence" class="section evidence-section">
        <div class="section-heading">
          <div>
            <p class="kicker">07 / EVIDENCE BOUNDARY</p>
            <h2>“像不像”由阅读决定，指标只负责提醒</h2>
          </div>
          <p>
            最终版本不是按误差最低自动选出。多个中间版本即使数字尚可，仍因广播假设、故事串场、同类同话术或注意持续过久被人工驳回。
          </p>
        </div>

        <div class="evidence-grid">
          <article class="review-card">
            <div class="review-number">{{ demo.meta.reviewedDecisions }}</div>
            <p>个不重复智能体决策由主审阅者逐条阅读</p>
            <ul>
              <li>同时查看事件阶段、画像变体和上一轮记忆</li>
              <li>判断谁会知晓、发言、追问或退出注意</li>
              <li>相似文本由语义判断区分“合理同需”与“角色坍塌”</li>
            </ul>
          </article>
          <article class="claim-card accepted">
            <header><i>✓</i><span>当前可以表达</span></header>
            <ul>
              <li v-for="item in demo.review.accepted" :key="item">{{ item }}</li>
            </ul>
          </article>
          <article class="claim-card rejected">
            <header><i>×</i><span>当前不能表达</span></header>
            <ul>
              <li v-for="item in demo.review.notClaimed" :key="item">{{ item }}</li>
            </ul>
          </article>
        </div>
        <div class="limitation-note">
          <strong>主动保留的缺陷</strong>
          <p>{{ demo.review.knownLimitation }}</p>
          <span>这不是宣传减分项，而是模型不会把不支持的东西包装成结论的证据。</span>
        </div>
      </section>

      <footer class="page-footer">
        <div>
          <strong>CampusPulse</strong>
          <span>数据驱动的典型人群治理推演</span>
        </div>
        <p>浏览器仅加载脱敏聚合数据与经审阅合成发言；不包含原始论坛行、标识、路径或提示词。</p>
        <span>V1 · {{ demo.review.verdict }}</span>
      </footer>
    </main>

    <main v-else class="loading-state">
      <div v-if="loading" class="loader"><i></i><span>正在装载代表性人口…</span></div>
      <div v-else class="load-error">
        <strong>演示数据加载失败</strong>
        <p>{{ errorMessage }}</p>
        <button type="button" @click="loadDemo">重新加载</button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const demo = ref(null)
const loading = ref(true)
const errorMessage = ref('')
const scenarioId = ref('tongzhou')
const phaseId = ref('burst')
const policyId = ref('baseline')
const governanceCaseId = ref('course')
const fidelityCaseId = ref('procedure')
const selectedArchetypeId = ref('archetype-01')
const playing = ref(false)
let playbackTimer = null
let previousTitle = ''

const phaseKeys = ['baseline', 'burst', 'spread', 'decay']
const scenarioOptions = [
  { id: 'tongzhou', number: '01' },
  { id: 'lecture', number: '02' }
]
const domainLegend = [
  { id: 'information', label: '信息核实' },
  { id: 'action', label: '行动求助' },
  { id: 'governance', label: '治理讨论' },
  { id: 'resource', label: '资源匹配' },
  { id: 'support', label: '关系与支持' }
]

const scenario = computed(() => demo.value?.scenarios?.[scenarioId.value] || null)
const currentPhase = computed(() => scenario.value?.phaseData?.[phaseId.value] || null)
const phaseIndex = computed(() => phaseKeys.indexOf(phaseId.value))
const currentPolicy = computed(() => scenario.value?.policies?.[policyId.value] || scenario.value?.policies?.baseline)
const currentMetrics = computed(() => currentPolicy.value?.metrics?.[phaseId.value] || { public: 0, relevant: 0, trust: 0, satisfied: 0 })
const currentGovernanceCase = computed(() => {
  const cases = scenario.value?.governanceBranchDemo?.cases || []
  return cases.find(item => item.id === governanceCaseId.value) || cases[0] || null
})
const currentGovernanceGaps = computed(() => {
  const gapSets = scenario.value?.governanceOrchestration?.gapsByCase || {}
  return gapSets[governanceCaseId.value] || []
})
const currentFidelityCase = computed(() => {
  const cases = demo.value?.crossShockFidelity?.cases || []
  return cases.find(item => item.id === fidelityCaseId.value) || cases[0] || null
})
const selectedArchetype = computed(() => demo.value?.population.archetypes.find(item => item.id === selectedArchetypeId.value))
const maxTopicValue = computed(() => Math.max(1, ...currentPhase.value.topics.map(topic => topic.value)))
const currentMessages = computed(() => {
  if (!scenario.value) return []
  if (scenarioId.value === 'tongzhou' && policyId.value === 'combined' && phaseId.value !== 'baseline') {
    return scenario.value.combinedMessages?.[phaseId.value] || []
  }
  return scenario.value.messages?.[phaseId.value] || []
})
const expressionCases = computed(() =>
  demo.value?.expressionPilot?.examples?.filter(item => item.scenario === scenarioId.value) || []
)
const agentDots = computed(() => {
  if (!demo.value) return []
  let cursor = 0
  return demo.value.population.archetypes.flatMap(archetype =>
    Array.from({ length: archetype.count }, (_, index) => {
      cursor += 1
      return {
        key: `${archetype.id}-${index}`,
        archetypeId: archetype.id,
        domain: archetype.domain,
        label: archetype.label,
        agentLabel: `智能体 ${String(cursor).padStart(2, '0')}`,
        shortIndex: String(cursor).padStart(2, '0')
      }
    })
  )
})

async function loadDemo() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetch('/campus-pulse-data/representative-simulation.json', { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    demo.value = await response.json()
  } catch (error) {
    errorMessage.value = `无法读取脱敏演示数据：${error.message}`
  } finally {
    loading.value = false
  }
}

function selectScenario(id) {
  stopPlayback()
  scenarioId.value = id
  policyId.value = 'baseline'
  phaseId.value = 'burst'
}

function selectPhase(id) {
  stopPlayback()
  phaseId.value = id
}

function togglePlayback() {
  if (playing.value) {
    stopPlayback()
    return
  }
  playing.value = true
  const current = phaseKeys.indexOf(phaseId.value)
  if (current === phaseKeys.length - 1) phaseId.value = 'baseline'
  playbackTimer = window.setInterval(() => {
    const index = phaseKeys.indexOf(phaseId.value)
    if (index >= phaseKeys.length - 1) {
      stopPlayback()
      return
    }
    phaseId.value = phaseKeys[index + 1]
  }, 2400)
}

function stopPlayback() {
  playing.value = false
  if (playbackTimer) {
    window.clearInterval(playbackTimer)
    playbackTimer = null
  }
}

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(value && value < 0.02 ? 1 : 0)}%`
}

function signed(value) {
  const number = Number(value || 0)
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}`
}

function stanceLabel(value) {
  return {
    concerned: '担忧',
    critical: '批评',
    neutral: '核实',
    supportive: '支持'
  }[value] || value
}

function phaseLabel(value) {
  return scenario.value?.phaseData?.[value]?.label || demo.value?.scenarios?.tongzhou?.phaseData?.[value]?.label || value
}

onMounted(() => {
  previousTitle = document.title
  document.title = 'CampusPulse · 代表人群治理推演'
  loadDemo()
})
onBeforeUnmount(() => {
  stopPlayback()
  if (previousTitle) document.title = previousTitle
})
</script>

<style scoped>
.sim-shell {
  --bg: #07110f;
  --bg-soft: #0b1714;
  --panel: #0e1d19;
  --panel-2: #12241f;
  --line: rgba(212, 235, 226, 0.13);
  --line-strong: rgba(212, 235, 226, 0.24);
  --text: #f3f6f1;
  --muted: #91a59e;
  --mint: #73e2b7;
  --mint-soft: rgba(115, 226, 183, 0.13);
  --orange: #ff9866;
  --purple: #a89cff;
  --blue: #62b8ff;
  --rose: #ef7ca8;
  min-height: 100vh;
  height: 100vh;
  overflow-y: auto;
  color: var(--text);
  background:
    radial-gradient(circle at 76% -4%, rgba(75, 187, 144, 0.13), transparent 28rem),
    radial-gradient(circle at -8% 24%, rgba(168, 156, 255, 0.08), transparent 25rem),
    var(--bg);
  font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}

:global(.light-theme) .sim-shell {
  --bg: #f1f3ee;
  --bg-soft: #e9eee8;
  --panel: #ffffff;
  --panel-2: #f7faf6;
  --line: rgba(22, 50, 40, 0.13);
  --line-strong: rgba(22, 50, 40, 0.23);
  --text: #102019;
  --muted: #66766f;
  --mint: #147957;
  --mint-soft: rgba(20, 121, 87, 0.1);
  --orange: #d76234;
  --purple: #7665d3;
  --blue: #267ab8;
  --rose: #c24b78;
}

button { font: inherit; }

.topbar,
.page {
  width: min(1440px, calc(100% - 64px));
  margin: 0 auto;
}

.topbar {
  min-height: 76px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  border-bottom: 1px solid var(--line);
}

.back-link {
  width: max-content;
  display: inline-flex;
  gap: 9px;
  align-items: center;
  color: var(--muted);
  text-decoration: none;
  font-size: 0.78rem;
}

.back-link:hover,
.back-link:focus-visible { color: var(--mint); }

.brand {
  display: flex;
  gap: 10px;
  align-items: center;
}

.brand-mark {
  width: 35px;
  height: 35px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: #06100d;
  background: var(--mint);
  font-family: "Noto Serif SC", serif;
  font-weight: 900;
}

.brand div { display: grid; }
.brand strong { font-size: 0.9rem; letter-spacing: 0.01em; }
.brand small { margin-top: 2px; color: var(--muted); font-size: 0.62rem; }

.snapshot {
  justify-self: end;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  margin-right: 74px;
  color: var(--muted);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.snapshot i,
.live-state i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--mint);
  box-shadow: 0 0 0 4px var(--mint-soft);
}

.page { padding: 74px 0 40px; }

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(380px, 0.65fr);
  gap: clamp(50px, 8vw, 130px);
  align-items: end;
}

.eyebrow,
.kicker {
  margin: 0 0 13px;
  color: var(--mint);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.18em;
}

h1,
h2,
h3,
p { margin-top: 0; }

h1 {
  max-width: 950px;
  margin-bottom: 24px;
  font-family: Georgia, "Noto Serif SC", "Songti SC", serif;
  font-size: clamp(2.6rem, 5.5vw, 5.7rem);
  font-weight: 520;
  line-height: 1.06;
  letter-spacing: -0.052em;
}

h1 em {
  color: var(--mint);
  font-style: normal;
}

.hero-intro {
  max-width: 760px;
  margin-bottom: 0;
  color: var(--muted);
  font-size: 1rem;
  line-height: 1.9;
}

.hero-actions {
  display: flex;
  gap: 24px;
  align-items: center;
  margin-top: 32px;
}

.primary-action,
.text-action {
  border: 0;
  color: inherit;
  cursor: pointer;
}

.primary-action {
  display: inline-flex;
  gap: 28px;
  align-items: center;
  padding: 13px 17px 13px 20px;
  border-radius: 7px;
  color: #07110f;
  background: var(--mint);
  font-size: 0.78rem;
  font-weight: 780;
}

.primary-action span {
  width: 23px;
  height: 23px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(7, 17, 15, 0.13);
}

.text-action {
  padding: 9px 0;
  border-bottom: 1px solid var(--line-strong);
  background: transparent;
  color: var(--muted);
  font-size: 0.75rem;
}

.workbench-action { text-decoration: none; }

.hero-console {
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(14, 29, 25, 0.62);
  backdrop-filter: blur(12px);
}

:global(.light-theme) .hero-console { background: rgba(255, 255, 255, 0.72); }

.console-head {
  display: flex;
  justify-content: space-between;
  padding: 12px 12px 16px;
  color: var(--muted);
  font-size: 0.66rem;
}

.scenario-option {
  width: 100%;
  display: grid;
  grid-template-columns: 34px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 17px 15px;
  border: 0;
  border-top: 1px solid var(--line);
  color: var(--muted);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.scenario-option:hover,
.scenario-option:focus-visible,
.scenario-option.active {
  color: var(--text);
  background: var(--mint-soft);
  outline: none;
}

.scenario-number { font-family: Georgia, serif; color: var(--mint); }
.scenario-option > span:nth-child(2) { display: grid; gap: 4px; }
.scenario-option strong { font-size: 0.88rem; }
.scenario-option small { color: var(--muted); font-size: 0.68rem; }
.scenario-option > i { font-style: normal; }

.console-result {
  display: grid;
  gap: 4px;
  margin: 8px 0 0;
  padding: 17px 15px;
  border-radius: 10px;
  color: #07110f;
  background: var(--mint);
}

.console-result span,
.console-result small { font-size: 0.64rem; opacity: 0.64; }
.console-result strong { font-size: 0.9rem; }

.metric-rail {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr auto 1.25fr;
  gap: 18px;
  align-items: center;
  margin: 76px 0 0;
  padding: 21px 24px;
  border-block: 1px solid var(--line);
}

.metric-rail article { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; align-items: baseline; }
.metric-rail article span { grid-column: 1 / -1; color: var(--muted); font-size: 0.6rem; }
.metric-rail article strong { font-family: Georgia, serif; font-size: 1.65rem; font-weight: 500; }
.metric-rail article small { color: var(--muted); font-size: 0.67rem; }
.metric-rail .reviewed-metric strong { color: var(--mint); }
.rail-arrow { color: var(--line-strong); font-style: normal; }

.section {
  padding-top: 112px;
  scroll-margin-top: 24px;
}

.section-heading {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(340px, 0.62fr);
  gap: 70px;
  align-items: end;
  margin-bottom: 44px;
}

.section-heading h2 {
  max-width: 840px;
  margin-bottom: 0;
  font-family: Georgia, "Noto Serif SC", "Songti SC", serif;
  font-size: clamp(2rem, 3.8vw, 3.6rem);
  font-weight: 540;
  line-height: 1.13;
  letter-spacing: -0.04em;
}

.section-heading > p,
.event-caption p {
  margin-bottom: 0;
  color: var(--muted);
  font-size: 0.82rem;
  line-height: 1.85;
}

.population-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.7fr) minmax(260px, 0.62fr);
  gap: 16px;
}

.agent-map-card,
.persona-card,
.archetype-list,
.phase-card,
.transcript-card,
.policy-package,
.effect-card,
.group-outcomes,
.expression-card,
.function-evidence,
.thread-card,
.review-card,
.claim-card {
  border: 1px solid var(--line);
  border-radius: 15px;
  background: var(--panel);
}

.agent-map-card { padding: 25px; }

.map-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  margin-bottom: 30px;
}

.map-header > div:first-child { display: grid; gap: 4px; }
.map-header span { color: var(--muted); font-size: 0.66rem; }
.map-header strong { font-family: Georgia, serif; font-size: 1.05rem; letter-spacing: 0.1em; }
.live-state { display: inline-flex; gap: 8px; align-items: center; color: var(--muted); font-size: 0.65rem; }

.agent-map {
  display: grid;
  grid-template-columns: repeat(8, minmax(32px, 1fr));
  gap: 10px;
}

.agent-dot {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 50%;
  color: rgba(7, 17, 15, 0.8);
  background: var(--mint);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.agent-dot span { font-size: 0.54rem; font-weight: 820; }
.agent-dot:hover,
.agent-dot:focus-visible { transform: translateY(-3px); outline: none; }
.agent-dot.selected { border-color: var(--text); box-shadow: 0 0 0 4px var(--mint-soft); transform: scale(1.06); }

.agent-dot.domain-information,
.domain-legend i.domain-information,
.archetype-list i.domain-information { background: var(--mint); }
.agent-dot.domain-action,
.domain-legend i.domain-action,
.archetype-list i.domain-action { background: var(--blue); }
.agent-dot.domain-governance,
.domain-legend i.domain-governance,
.archetype-list i.domain-governance { background: var(--orange); }
.agent-dot.domain-resource,
.domain-legend i.domain-resource,
.archetype-list i.domain-resource { background: var(--purple); }
.agent-dot.domain-support,
.domain-legend i.domain-support,
.archetype-list i.domain-support { background: var(--rose); }

.domain-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  margin-top: 25px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}

.domain-legend span { display: inline-flex; gap: 6px; align-items: center; color: var(--muted); font-size: 0.62rem; }
.domain-legend i,
.archetype-list i { width: 7px; height: 7px; border-radius: 50%; }

.persona-card {
  position: relative;
  overflow: hidden;
  padding: 28px;
}

.persona-index {
  position: absolute;
  top: -13px;
  right: 8px;
  color: rgba(145, 165, 158, 0.08);
  font-family: Georgia, serif;
  font-size: 6rem;
  line-height: 1;
}

.persona-card > p:first-of-type { position: relative; margin-bottom: 8px; color: var(--mint); font-size: 0.62rem; letter-spacing: 0.1em; }
.persona-card h3 { position: relative; margin-bottom: 25px; font-family: Georgia, "Songti SC", serif; font-size: 1.65rem; font-weight: 550; }

.persona-weight { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; border-block: 1px solid var(--line); }
.persona-weight div { padding: 17px 4px; }
.persona-weight span,
.variant-list > span { display: block; color: var(--muted); font-size: 0.6rem; }
.persona-weight strong { display: block; margin-top: 5px; font-family: Georgia, serif; font-size: 1.25rem; }

.variant-list { margin-top: 22px; }
.variant-list .variant-chip {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  color: var(--text);
  background: var(--bg-soft);
  text-align: left;
  font-size: 0.7rem;
}

.persona-note { margin: 18px 0 0; color: var(--muted); font-size: 0.66rem; line-height: 1.6; }

.archetype-list { max-height: 505px; overflow-y: auto; padding: 8px; }
.archetype-list > button {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 10px 9px;
  border: 0;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.archetype-list > button:hover,
.archetype-list > button:focus-visible,
.archetype-list > button.active { color: var(--text); background: var(--mint-soft); outline: none; }
.archetype-list span { font-size: 0.69rem; }
.archetype-list small { font-size: 0.6rem; }
.background-mass { display: grid; gap: 4px; padding: 14px 9px; color: var(--muted); }
.background-mass span { color: var(--orange); font-size: 0.65rem; }
.background-mass small { font-size: 0.58rem; line-height: 1.45; }

.fidelity-lab {
  margin-top: 28px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: var(--panel);
}
.fidelity-lab-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 30px; align-items: end; padding: 25px; }
.fidelity-lab-header > div { display: grid; gap: 6px; }
.fidelity-lab-header span { color: var(--mint); font-size: 0.58rem; letter-spacing: 0.08em; }
.fidelity-lab-header h3 { margin: 0; font-family: Georgia, "Songti SC", serif; font-size: 1.45rem; font-weight: 520; }
.fidelity-lab-header p { max-width: 680px; margin: 2px 0 0; color: var(--muted); font-size: 0.64rem; line-height: 1.55; }
.fidelity-scoreboard { display: grid; grid-template-columns: repeat(4, minmax(70px, 1fr)); margin: 0; border: 1px solid var(--line); border-radius: 9px; }
.fidelity-scoreboard div { min-width: 78px; padding: 11px 14px; }
.fidelity-scoreboard div + div { border-left: 1px solid var(--line); }
.fidelity-scoreboard dt { color: var(--muted); font-size: 0.52rem; }
.fidelity-scoreboard dd { margin: 4px 0 0; font-family: Georgia, serif; font-size: 1.15rem; }
.fidelity-scoreboard .score-clear dd { color: var(--mint); }
.fidelity-scoreboard .score-partial dd { color: var(--orange); }
.gate-acceptance-strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  align-items: center;
  margin: 0 24px 22px;
  padding: 16px 18px;
  border: 1px solid rgba(115, 226, 183, 0.34);
  border-radius: 11px;
  background: linear-gradient(110deg, var(--mint-soft), rgba(98, 184, 255, 0.06));
}
.gate-acceptance-strip > div { display: grid; gap: 5px; }
.gate-acceptance-strip > div > span { color: var(--mint); font-size: 0.52rem; letter-spacing: 0.08em; }
.gate-acceptance-strip > div > strong { font-family: Georgia, "Songti SC", serif; font-size: 0.86rem; font-weight: 520; }
.gate-acceptance-strip > div > p { max-width: 680px; margin: 0; color: var(--muted); font-size: 0.59rem; line-height: 1.55; }
.gate-acceptance-strip dl { display: grid; grid-template-columns: repeat(3, auto); margin: 0; }
.gate-acceptance-strip dl > div { min-width: 92px; padding: 4px 14px; border-left: 1px solid var(--line); }
.gate-acceptance-strip dt { color: var(--muted); font-size: 0.5rem; }
.gate-acceptance-strip dd { margin: 4px 0 0; color: var(--mint); font-size: 0.67rem; font-weight: 650; }
.fidelity-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; border-block: 1px solid var(--line); background: var(--line); }
.fidelity-tabs button { display: flex; justify-content: space-between; gap: 10px; align-items: center; min-width: 0; padding: 13px 16px; border: 0; color: var(--muted); background: var(--panel); cursor: pointer; text-align: left; }
.fidelity-tabs button:hover,
.fidelity-tabs button:focus-visible,
.fidelity-tabs button.active { color: var(--text); background: var(--mint-soft); outline: none; }
.fidelity-tabs span { overflow: hidden; font-size: 0.64rem; text-overflow: ellipsis; white-space: nowrap; }
.fidelity-tabs small { flex: none; color: var(--muted); font-size: 0.52rem; }
.fidelity-tabs button.active small { color: var(--mint); }
.fidelity-tabs .tab-rating-update { display: grid; gap: 2px; text-align: right; }
.fidelity-tabs .tab-rating-update s { color: var(--orange); font-size: 0.45rem; font-weight: 400; }
.fidelity-tabs .tab-rating-update em { color: var(--mint); font-size: 0.52rem; font-style: normal; font-weight: 650; }
.fidelity-case { padding: 24px; }
.fidelity-case > header { display: flex; justify-content: space-between; gap: 20px; align-items: baseline; }
.fidelity-case > header > div { display: flex; gap: 9px; align-items: baseline; flex-wrap: wrap; }
.fidelity-case > header span { color: var(--mint); font-size: 0.54rem; }
.fidelity-case > header strong { font-size: 0.72rem; }
.fidelity-case > header small { color: var(--muted); font-size: 0.56rem; }
.fidelity-case > header b { padding: 6px 9px; border-radius: 999px; color: #07110f; background: var(--mint); font-size: 0.54rem; }
.fidelity-case.rating-partial_non_regressive > header b { background: var(--orange); }
.fidelity-case.has-gate-repair > header b { background: var(--mint); }
.fidelity-case > header .fidelity-rating { justify-content: flex-end; }
.fidelity-rating small { color: var(--orange) !important; }
.fidelity-claim { display: grid; grid-template-columns: minmax(220px, 0.48fr) 1fr; gap: 26px; align-items: center; margin: 17px 0; padding: 15px 17px; border-left: 3px solid var(--mint); background: var(--mint-soft); }
.rating-partial_non_regressive .fidelity-claim { border-left-color: var(--orange); background: rgba(255, 152, 102, 0.08); }
.rating-partial_non_regressive .repaired-claim { border-left-color: var(--mint); background: var(--mint-soft); }
.fidelity-claim strong { font-family: Georgia, "Songti SC", serif; font-size: 0.86rem; font-weight: 520; }
.fidelity-claim p { margin: 0; color: var(--muted); font-size: 0.63rem; line-height: 1.55; }
.fidelity-trajectories { display: grid; grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr) 24px minmax(0, 1fr); gap: 8px; align-items: stretch; }
.fidelity-trajectories > i { display: grid; place-items: center; color: var(--muted); font-style: normal; }
.trajectory-card { display: grid; grid-template-rows: auto auto 1fr auto; gap: 9px; min-width: 0; padding: 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-soft); }
.trajectory-card > header { display: flex; justify-content: space-between; gap: 10px; }
.trajectory-card > header span,
.trajectory-card > header small { color: var(--muted); font-size: 0.52rem; }
.trajectory-card > b { color: var(--blue); font-size: 0.55rem; font-weight: 600; }
.trajectory-card > p { margin: 0; font-size: 0.67rem; line-height: 1.6; }
.trajectory-card > footer { padding-top: 9px; border-top: 1px solid var(--line); color: var(--muted); font-size: 0.54rem; }
.combined-trajectory { border-color: rgba(115, 226, 183, 0.36); background: var(--mint-soft); }
.combined-trajectory > b { color: var(--mint); }
.gate-repair-flow {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) 24px minmax(0, 0.9fr) 24px minmax(0, 1.2fr);
  gap: 8px;
  align-items: stretch;
}
.gate-repair-flow > i { display: grid; place-items: center; color: var(--muted); font-style: normal; }
.repair-card { display: grid; grid-template-rows: auto auto 1fr auto; gap: 10px; min-width: 0; padding: 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-soft); }
.repair-card > header { display: flex; justify-content: space-between; gap: 10px; }
.repair-card > header span,
.repair-card > header small { color: var(--muted); font-size: 0.52rem; }
.repair-card > b { color: var(--blue); font-size: 0.56rem; }
.repair-card > p { margin: 0; font-size: 0.64rem; line-height: 1.62; }
.repair-card > footer { padding-top: 9px; border-top: 1px solid var(--line); color: var(--muted); font-size: 0.54rem; line-height: 1.5; }
.old-drift-card { border-color: rgba(255, 152, 102, 0.32); background: rgba(255, 152, 102, 0.06); }
.old-drift-card > b,
.old-drift-card > header span { color: var(--orange); }
.gate-rule-card { border-color: rgba(98, 184, 255, 0.32); background: rgba(98, 184, 255, 0.06); }
.updated-route-card { border-color: rgba(115, 226, 183, 0.36); background: var(--mint-soft); }
.updated-route-card > header span { color: var(--mint); }
.updated-route { display: grid; gap: 10px; }
.updated-route > div { display: grid; gap: 5px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: rgba(7, 17, 15, 0.16); }
.updated-route b { color: var(--mint); font-size: 0.56rem; }
.updated-route small { color: var(--muted); font-size: 0.49rem; line-height: 1.4; }
.updated-route p { margin: 0; font-size: 0.58rem; line-height: 1.55; }
.updated-route em { color: var(--blue); font-size: 0.49rem; font-style: normal; }
.fidelity-boundary { display: grid; grid-template-columns: 72px 1fr auto; gap: 16px; align-items: center; padding: 14px 24px; border-top: 1px solid var(--line); background: rgba(98, 184, 255, 0.06); }
.fidelity-boundary strong { color: var(--blue); font-size: 0.56rem; }
.fidelity-boundary span,
.fidelity-boundary small { color: var(--muted); font-size: 0.55rem; line-height: 1.5; }
.fidelity-boundary small { text-align: right; }

.simulation-heading { align-items: center; }
.event-caption { padding-left: 20px; border-left: 2px solid var(--mint); }
.event-caption > span { display: block; margin-bottom: 8px; color: var(--mint); font-size: 0.67rem; }

.phase-navigator {
  display: grid;
  grid-template-columns: repeat(4, 1fr) 118px;
  gap: 1px;
  margin-bottom: 16px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: var(--line);
}

.phase-navigator > button:not(.play-button) {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 10px;
  padding: 15px 17px;
  border: 0;
  color: var(--muted);
  background: var(--panel);
  text-align: left;
  cursor: pointer;
}
.phase-navigator > button:not(.play-button):hover,
.phase-navigator > button:not(.play-button):focus-visible,
.phase-navigator > button.active { color: var(--text); background: var(--panel-2); outline: none; }
.phase-navigator button > span { grid-row: 1 / 3; color: var(--mint); font-family: Georgia, serif; font-size: 0.72rem; }
.phase-navigator button strong { font-size: 0.75rem; }
.phase-navigator button small { font-size: 0.59rem; }
.phase-bar { grid-column: 1 / -1; height: 3px; margin-top: 8px; background: var(--line); }
.phase-bar b { display: block; height: 100%; background: var(--mint); transition: width 0.35s ease; }
.play-button { border: 0; color: #07110f; background: var(--mint); cursor: pointer; font-size: 0.67rem; font-weight: 750; }
.play-button span { display: block; margin-bottom: 5px; color: inherit; font-family: inherit; }
.play-button.playing { background: var(--orange); }

.simulation-grid { display: grid; grid-template-columns: minmax(360px, 0.72fr) minmax(0, 1.28fr); gap: 16px; }
.phase-card,
.transcript-card { padding: 28px; }
.phase-card-top { display: flex; justify-content: space-between; gap: 20px; }
.phase-card-top > div:first-child { display: grid; gap: 3px; }
.phase-card-top span { color: var(--mint); font-size: 0.61rem; }
.phase-card-top h3 { margin: 2px 0 0; font-family: Georgia, "Songti SC", serif; font-size: 2rem; font-weight: 520; }
.phase-card-top small { color: var(--muted); font-size: 0.67rem; }
.phase-pulse { position: relative; width: 52px; height: 52px; }
.phase-pulse i { position: absolute; inset: 0; border: 1px solid var(--mint); border-radius: 50%; opacity: 0.2; animation: pulse 2.2s ease-out infinite; }
.phase-pulse i:nth-child(2) { inset: 8px; animation-delay: 0.35s; }
.phase-pulse i:nth-child(3) { inset: 17px; background: var(--mint); opacity: 1; animation: none; }
.pulse-baseline i,
.pulse-decay i { animation-duration: 3.4s; }
.pulse-burst i { animation-duration: 1.25s; }
.phase-story { min-height: 48px; margin: 22px 0; color: var(--muted); font-size: 0.75rem; line-height: 1.7; }

.seed-comparison { display: grid; gap: 13px; padding: 17px; border-radius: 10px; background: var(--bg-soft); }
.seed-comparison > div { display: grid; grid-template-columns: 80px 1fr; gap: 5px 12px; align-items: baseline; }
.seed-comparison span { color: var(--muted); font-size: 0.59rem; }
.seed-comparison strong { justify-self: end; font-family: Georgia, serif; font-size: 1.05rem; }
.seed-comparison strong small { margin-left: 5px; color: var(--muted); font-family: inherit; font-size: 0.55rem; }
.seed-comparison i { grid-column: 1 / -1; height: 3px; background: var(--line); }
.seed-comparison i b { display: block; height: 100%; background: var(--mint); }

.phase-kpis { display: grid; grid-template-columns: repeat(4, 1fr); margin: 23px 0; border-block: 1px solid var(--line); }
.phase-kpis div { padding: 15px 5px; }
.phase-kpis span { display: block; min-height: 25px; color: var(--muted); font-size: 0.55rem; }
.phase-kpis strong { display: block; font-family: Georgia, serif; font-size: 1.12rem; }

.subhead { display: flex; justify-content: space-between; margin-bottom: 11px; }
.subhead span { color: var(--text); font-size: 0.65rem; }
.subhead small { color: var(--muted); font-size: 0.55rem; }
.topic-row { display: grid; grid-template-columns: 100px 1fr 22px; gap: 8px; align-items: center; min-height: 24px; }
.topic-row span { overflow: hidden; color: var(--muted); font-size: 0.59rem; text-overflow: ellipsis; white-space: nowrap; }
.topic-row i { height: 5px; border-radius: 4px; background: var(--line); }
.topic-row i b { display: block; height: 100%; border-radius: inherit; background: var(--purple); }
.topic-row strong { font-size: 0.6rem; text-align: right; }

.transcript-head { display: flex; justify-content: space-between; gap: 20px; align-items: start; }
.transcript-head p { margin-bottom: 6px; color: var(--mint); font-size: 0.61rem; }
.transcript-head h3 { margin-bottom: 0; font-family: Georgia, "Songti SC", serif; font-size: 1.25rem; font-weight: 520; }
.policy-switch { display: flex; padding: 3px; border: 1px solid var(--line); border-radius: 8px; }
.policy-switch button { padding: 7px 10px; border: 0; border-radius: 5px; color: var(--muted); background: transparent; cursor: pointer; font-size: 0.62rem; }
.policy-switch button.active { color: #07110f; background: var(--mint); }
.policy-context { display: flex; gap: 9px; align-items: center; margin: 20px 0 12px; padding: 10px 12px; border-left: 2px solid var(--line-strong); color: var(--muted); background: var(--bg-soft); font-size: 0.63rem; line-height: 1.5; }
.policy-context i { flex: 0 0 auto; width: 7px; height: 7px; border-radius: 50%; background: var(--muted); }
.policy-context i.policy-on { background: var(--mint); box-shadow: 0 0 0 4px var(--mint-soft); }

.message-feed { display: grid; gap: 1px; min-height: 372px; background: var(--line); }
.message-item { display: grid; grid-template-columns: 38px 1fr; gap: 13px; padding: 16px 13px; background: var(--panel); }
.agent-avatar { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 11px; color: #07110f; background: var(--mint); font-family: Georgia, serif; font-size: 0.68rem; }
.agent-avatar.stance-critical { background: var(--orange); }
.agent-avatar.stance-neutral { background: var(--blue); }
.agent-avatar.stance-supportive { background: var(--rose); }
.message-item header { display: flex; flex-wrap: wrap; gap: 5px 8px; align-items: baseline; }
.message-item header strong { font-size: 0.7rem; }
.message-item header span { color: var(--muted); font-size: 0.58rem; }
.message-item header small { margin-left: auto; padding: 2px 5px; border: 1px solid var(--line); border-radius: 4px; color: var(--muted); font-size: 0.54rem; }
.message-item p { margin: 7px 0 0; font-size: 0.76rem; line-height: 1.65; }
.transcript-card > footer { display: flex; justify-content: space-between; gap: 18px; margin-top: 13px; color: var(--muted); font-size: 0.56rem; }
.empty-transcript { color: var(--muted); }
.message-enter-active,
.message-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.message-enter-from,
.message-leave-to { opacity: 0; transform: translateY(8px); }

.shape-proof { display: grid; grid-template-columns: 0.7fr 1fr 0.8fr; gap: 50px; align-items: center; margin-top: 16px; padding: 22px 28px; border: 1px solid var(--line); border-radius: 13px; background: var(--bg-soft); }
.shape-proof p { margin-bottom: 5px; color: var(--mint); font-size: 0.59rem; }
.shape-proof h3 { margin-bottom: 0; font-size: 0.82rem; }
.shape-chart { height: 72px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; align-items: end; }
.shape-column { height: 100%; display: grid; grid-template-rows: 1fr auto; gap: 5px; }
.shape-bars { display: flex; gap: 4px; align-items: end; justify-content: center; }
.shape-bars i { width: 10px; min-height: 3px; background: var(--mint); }
.shape-bars i:nth-child(2) { background: var(--purple); }
.shape-column > span { color: var(--muted); font-size: 0.53rem; text-align: center; }
.shape-proof dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0; }
.shape-proof dt { min-height: 22px; color: var(--muted); font-size: 0.55rem; }
.shape-proof dd { margin: 4px 0 0; font-family: Georgia, serif; font-size: 0.88rem; }

.expression-proof {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
  gap: 18px;
  align-items: center;
  margin-bottom: 16px;
  padding: 20px 24px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--bg-soft);
}
.expression-proof article { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; align-items: baseline; }
.expression-proof article > span { grid-column: 1 / -1; color: var(--muted); font-size: 0.58rem; }
.expression-proof strong { font-family: Georgia, serif; font-size: 1.7rem; font-weight: 500; }
.expression-proof strong b { margin-left: 2px; font-family: inherit; font-size: 0.65rem; font-weight: 500; }
.expression-proof small { color: var(--muted); font-size: 0.58rem; line-height: 1.4; }
.expression-proof > i { color: var(--line-strong); font-style: normal; }
.expression-proof .proof-active strong { color: var(--mint); }

.expression-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.expression-card { overflow: hidden; }
.expression-card > header { display: flex; justify-content: space-between; gap: 18px; align-items: start; padding: 19px 21px; border-bottom: 1px solid var(--line); }
.expression-card header > div { display: grid; gap: 5px; }
.expression-card header span { color: var(--mint); font-size: 0.57rem; }
.expression-card header strong { font-size: 0.76rem; }
.expression-card header small { max-width: 120px; color: var(--muted); font-size: 0.57rem; text-align: right; }
.parent-context { padding: 12px 21px; border-bottom: 1px solid var(--line); background: rgba(98, 184, 255, 0.06); }
.parent-context span,
.expression-trace span { display: block; margin-bottom: 5px; color: var(--muted); font-size: 0.54rem; letter-spacing: 0.04em; }
.parent-context p { margin: 0; color: var(--muted); font-size: 0.64rem; line-height: 1.55; }
.expression-trace { display: grid; grid-template-rows: auto 22px auto; padding: 18px 21px 21px; }
.expression-trace > i { align-self: center; color: var(--mint); font-style: normal; }
.expression-trace p { margin: 0; font-size: 0.73rem; line-height: 1.65; }
.ledger-copy { padding-left: 12px; border-left: 2px solid var(--line-strong); }
.ledger-copy p { color: var(--muted); }
.forum-copy { padding: 13px 14px; border-radius: 9px; background: var(--mint-soft); }
.forum-copy span { color: var(--mint); }
.forum-copy p { font-size: 0.82rem; }
.expression-boundary { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 26px; margin-top: 16px; padding: 15px 19px; border-left: 3px solid var(--mint); background: var(--mint-soft); }
.expression-boundary strong { font-size: 0.64rem; line-height: 1.55; }
.expression-boundary span { color: var(--muted); font-size: 0.62rem; line-height: 1.55; }

.thread-proof { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; overflow: hidden; margin-bottom: 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--line); }
.thread-proof article { display: grid; grid-template-columns: auto 1fr; gap: 3px 8px; align-items: baseline; padding: 18px 20px; background: var(--bg-soft); }
.thread-proof article > span { grid-column: 1 / -1; color: var(--muted); font-size: 0.57rem; }
.thread-proof strong { font-family: Georgia, serif; font-size: 1.65rem; font-weight: 500; }
.thread-proof strong b { margin-left: 5px; font-family: inherit; font-size: 0.59rem; font-weight: 500; }
.thread-proof small { color: var(--muted); font-size: 0.56rem; line-height: 1.4; }
.thread-proof .proof-active strong { color: var(--mint); }

.function-evidence { margin-bottom: 16px; padding: 21px 23px; }
.function-evidence > header { display: flex; justify-content: space-between; gap: 30px; align-items: end; margin-bottom: 20px; }
.function-evidence > header > div { display: grid; gap: 5px; }
.function-evidence > header span { color: var(--mint); font-size: 0.56rem; letter-spacing: 0.06em; }
.function-evidence > header strong { font-size: 0.82rem; }
.function-evidence > header small { color: var(--muted); font-size: 0.56rem; }
.function-rate-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.function-rate-grid article { display: grid; gap: 10px; }
.function-rate-grid article > strong { font-size: 0.68rem; }
.function-rate-grid article > div { display: grid; grid-template-columns: 42px 1fr 38px; gap: 8px; align-items: center; }
.function-rate-grid span,
.function-rate-grid em { color: var(--muted); font-size: 0.53rem; font-style: normal; }
.function-rate-grid em { text-align: right; }
.function-rate-grid i { height: 4px; overflow: hidden; background: var(--line); }
.function-rate-grid i b { display: block; height: 100%; background: var(--purple); }
.function-rate-grid i b.holdout { background: var(--mint); }

.thread-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.thread-card { overflow: hidden; }
.thread-card > header { display: grid; gap: 5px; padding: 18px 20px; border-bottom: 1px solid var(--line); }
.thread-card > header span { color: var(--mint); font-size: 0.55rem; letter-spacing: 0.06em; }
.thread-card > header strong { font-size: 0.76rem; }
.thread-root { padding: 14px 19px; border-bottom: 1px solid var(--line); background: rgba(98, 184, 255, 0.06); }
.thread-root span { display: block; margin-bottom: 5px; color: var(--blue); font-size: 0.53rem; }
.thread-root p { margin: 0; color: var(--muted); font-size: 0.65rem; line-height: 1.55; }
.thread-card ol { margin: 0; padding: 6px 0; list-style: none; }
.thread-card li { display: grid; grid-template-columns: 20px 1fr; gap: 10px; padding: 11px 17px; }
.thread-card li + li { border-top: 1px solid rgba(255, 255, 255, 0.04); }
.thread-card li > i { width: 18px; height: 18px; display: grid; place-items: center; border-radius: 50%; color: #07110f; background: var(--mint); font-size: 0.5rem; font-style: normal; }
.thread-card li div > header { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
.thread-card li header strong { font-size: 0.59rem; }
.thread-card li header span { color: var(--purple); font-size: 0.51rem; }
.thread-card li p { margin: 5px 0 0; font-size: 0.68rem; line-height: 1.55; }
.thread-boundary { border-left-color: var(--purple); background: rgba(182, 154, 255, 0.08); }

.governance-branch-lab { margin-bottom: 18px; overflow: hidden; }
.branch-lab-head { display: flex; justify-content: space-between; gap: 24px; align-items: end; padding: 22px 24px; border-bottom: 1px solid var(--line); }
.branch-lab-head > div:first-child { display: grid; gap: 5px; }
.branch-lab-head span { color: var(--mint); font-size: 0.56rem; letter-spacing: 0.07em; }
.branch-lab-head strong { font-family: Georgia, "Songti SC", serif; font-size: 1.1rem; font-weight: 520; }
.branch-lab-head small { color: var(--muted); font-size: 0.57rem; }
.branch-case-switch { display: flex; padding: 3px; border: 1px solid var(--line); border-radius: 8px; }
.branch-case-switch button { padding: 8px 12px; border: 0; border-radius: 5px; color: var(--muted); background: transparent; cursor: pointer; font-size: 0.62rem; }
.branch-case-switch button.active { color: #07110f; background: var(--mint); }
.branch-common-root { display: grid; gap: 5px; margin: 18px 24px 0; padding: 17px 19px; border-left: 3px solid var(--blue); background: rgba(98, 184, 255, 0.07); }
.branch-common-root span { color: var(--blue); font-size: 0.54rem; }
.branch-common-root strong { font-size: 0.65rem; }
.branch-common-root p { margin: 3px 0 0; font-size: 0.78rem; line-height: 1.6; }
.branch-actor-list { padding: 5px 24px 10px; }
.branch-actor { padding: 18px 0; }
.branch-actor + .branch-actor { border-top: 1px solid var(--line); }
.branch-actor > header { display: grid; grid-template-columns: minmax(210px, 0.55fr) 1fr; gap: 24px; align-items: end; margin-bottom: 12px; }
.branch-actor > header > div { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.branch-actor > header span { color: var(--mint); font-size: 0.54rem; }
.branch-actor > header strong { font-size: 0.68rem; }
.branch-actor > header small { color: var(--muted); font-size: 0.56rem; }
.branch-actor > header p { margin: 0; color: var(--muted); font-size: 0.61rem; line-height: 1.5; text-align: right; }
.branch-reaction-pair { display: grid; grid-template-columns: 1fr 24px 1fr; gap: 10px; align-items: stretch; }
.branch-reaction-pair > i { display: grid; place-items: center; color: var(--muted); font-style: normal; }
.branch-reaction { display: grid; grid-template-rows: auto 1fr auto; gap: 10px; min-width: 0; padding: 15px 17px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-soft); }
.branch-reaction > header { display: flex; justify-content: space-between; gap: 12px; }
.branch-reaction header span { color: var(--muted); font-size: 0.57rem; }
.branch-reaction header b { color: var(--orange); font-size: 0.55rem; font-weight: 600; }
.branch-reaction p { margin: 0; font-size: 0.7rem; line-height: 1.6; }
.branch-reaction > small { color: var(--muted); font-size: 0.54rem; }
.combined-reaction { border-color: rgba(115, 226, 183, 0.35); background: var(--mint-soft); }
.combined-reaction header span,
.combined-reaction header b { color: var(--mint); }
.governance-branch-lab > footer { display: grid; grid-template-columns: 86px 1fr; gap: 16px; padding: 14px 24px; border-top: 1px solid var(--line); background: rgba(255, 152, 102, 0.06); }
.governance-branch-lab > footer strong { color: var(--orange); font-size: 0.58rem; }
.governance-branch-lab > footer span { color: var(--muted); font-size: 0.58rem; line-height: 1.5; }

.orchestration-board {
  margin: 22px 0 18px;
  overflow: hidden;
  border: 1px solid rgba(115, 226, 183, 0.28);
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(115, 226, 183, 0.075), transparent 42%),
    var(--panel);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.13);
}

.orchestration-head {
  display: flex;
  justify-content: space-between;
  gap: 28px;
  align-items: start;
  padding: 25px 27px 21px;
  border-bottom: 1px solid var(--line);
}

.orchestration-head > div { display: grid; gap: 6px; }
.orchestration-head span,
.comparison-contract header span,
.external-contrast > span {
  color: var(--mint);
  font-size: 0.54rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.orchestration-head h3 {
  margin: 0;
  font-family: Georgia, "Songti SC", serif;
  font-size: 1.45rem;
  font-weight: 520;
  letter-spacing: -0.02em;
}

.orchestration-head p {
  max-width: 760px;
  margin: 0;
  color: var(--muted);
  font-size: 0.66rem;
  line-height: 1.65;
}

.orchestration-head > strong {
  flex: 0 0 auto;
  padding: 8px 10px;
  border: 1px solid rgba(115, 226, 183, 0.3);
  border-radius: 999px;
  color: var(--mint);
  background: var(--mint-soft);
  font-size: 0.56rem;
}

.orchestration-facts {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: 0;
  border-bottom: 1px solid var(--line);
}

.orchestration-facts > div {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1px 10px;
  align-items: baseline;
  padding: 17px 22px;
}

.orchestration-facts > div + div { border-left: 1px solid var(--line); }
.orchestration-facts dt { grid-column: 1 / -1; color: var(--muted); font-size: 0.53rem; }
.orchestration-facts dd { margin: 0; color: var(--mint); font-family: Georgia, serif; font-size: 1.65rem; }
.orchestration-facts small { color: var(--muted); font-size: 0.52rem; }
.orchestration-facts .fact-zero dd { color: var(--orange); }

.orchestration-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(330px, 0.65fr);
}

.orchestration-timeline {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0;
  padding: 22px;
  border-right: 1px solid var(--line);
  list-style: none;
}

.orchestration-step {
  position: relative;
  display: grid;
  grid-template-columns: 34px 1fr;
  gap: 12px;
  min-width: 0;
  padding: 17px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--bg-soft);
}

.orchestration-step::after {
  position: absolute;
  right: 12px;
  bottom: 10px;
  color: rgba(115, 226, 183, 0.13);
  content: 'MODEL';
  font-size: 0.48rem;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.orchestration-step.step-service { border-color: rgba(115, 226, 183, 0.35); }
.orchestration-step.step-monitor { border-color: rgba(168, 156, 255, 0.32); }

.step-index {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #07110f;
  background: var(--mint);
  font-family: Georgia, serif;
  font-size: 0.64rem;
}

.step-copy { min-width: 0; }
.step-copy > header { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.step-copy > header span { color: var(--mint); font-size: 0.55rem; }
.step-copy > header b { color: var(--muted); font-size: 0.54rem; font-weight: 600; }
.step-copy h4 { margin: 8px 0 7px; font-size: 0.84rem; }
.step-copy > p { min-height: 42px; margin: 0 0 13px; color: var(--muted); font-size: 0.61rem; line-height: 1.55; }
.step-copy dl { display: grid; gap: 6px; margin: 0; }
.step-copy dl > div { display: grid; grid-template-columns: 34px 1fr; gap: 7px; }
.step-copy dt { color: var(--muted); font-size: 0.5rem; }
.step-copy dd { margin: 0; font-size: 0.54rem; line-height: 1.4; }

.orchestration-assurance { display: grid; align-content: start; }
.orchestration-assurance > section { padding: 20px 22px; }
.orchestration-assurance > section + section { border-top: 1px solid var(--line); }
.comparison-contract header { display: grid; gap: 5px; margin-bottom: 15px; }
.comparison-contract header strong { font-size: 0.72rem; }
.comparison-contract dl { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0; }
.comparison-contract dl > div { display: grid; gap: 3px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; }
.comparison-contract dt { color: var(--muted); font-size: 0.49rem; }
.comparison-contract dd { margin: 0; color: var(--mint); font-size: 0.6rem; font-weight: 700; }
.comparison-contract small { color: var(--muted); font-size: 0.48rem; line-height: 1.45; }

.gap-register { background: rgba(255, 152, 102, 0.055); }
.gap-register > header { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
.gap-register header span { color: var(--orange); font-size: 0.54rem; font-weight: 800; }
.gap-register header strong { font-size: 0.62rem; }
.gap-register ul { display: grid; gap: 8px; margin: 13px 0 12px; padding: 0; list-style: none; }
.gap-register li { font-size: 0.61rem; line-height: 1.5; }
.gap-register li::before { content: '→'; margin-right: 7px; color: var(--orange); }
.gap-register > p { margin: 0; color: var(--muted); font-size: 0.52rem; line-height: 1.5; }

.external-contrast { display: grid; gap: 6px; background: rgba(168, 156, 255, 0.06); }
.external-contrast > span { color: var(--purple); }
.external-contrast strong { font-size: 0.68rem; }
.external-contrast p { margin: 0; color: var(--muted); font-size: 0.55rem; line-height: 1.55; }

.orchestration-board > footer {
  display: grid;
  grid-template-columns: 86px 1fr;
  gap: 16px;
  padding: 14px 24px;
  border-top: 1px solid var(--line);
  background: rgba(255, 152, 102, 0.06);
}

.orchestration-board > footer strong { color: var(--orange); font-size: 0.58rem; }
.orchestration-board > footer span { color: var(--muted); font-size: 0.58rem; line-height: 1.5; }

.governance-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 0.72fr); gap: 16px; }
.policy-package { grid-row: span 2; overflow: hidden; }
.policy-package > header,
.effect-card > header { display: flex; justify-content: space-between; gap: 20px; padding: 20px 24px; border-bottom: 1px solid var(--line); }
.policy-package header span,
.effect-card header span { color: var(--muted); font-size: 0.62rem; }
.policy-package header strong { color: var(--mint); font-family: Georgia, serif; font-size: 0.72rem; letter-spacing: 0.08em; }
.policy-package ol { margin: 0; padding: 0; list-style: none; }
.policy-package li { display: grid; grid-template-columns: 42px 1fr; gap: 14px; align-items: start; padding: 20px 24px; border-bottom: 1px solid var(--line); }
.policy-package li:last-child { border-bottom: 0; }
.policy-package li span { color: var(--mint); font-family: Georgia, serif; font-size: 0.75rem; }
.policy-package li p { margin: 0; font-size: 0.76rem; line-height: 1.65; }
.effect-card { padding-bottom: 20px; }
.effect-card header { display: grid; gap: 4px; }
.effect-card header strong { font-size: 0.84rem; }
.effect-comparison { display: grid; grid-template-columns: 1fr auto 1fr; gap: 14px; align-items: center; padding: 22px 24px 16px; }
.effect-comparison > div { display: grid; gap: 2px; }
.effect-comparison span,
.effect-comparison small { color: var(--muted); font-size: 0.57rem; }
.effect-comparison strong { font-family: Georgia, serif; font-size: 2rem; font-weight: 500; }
.effect-comparison > i { color: var(--muted); font-style: normal; }
.effect-positive strong { color: var(--mint); }
.trust-change { display: grid; grid-template-columns: 58px 1fr 30px; gap: 5px 10px; align-items: center; padding: 0 24px; }
.trust-change span { grid-row: 1 / 3; color: var(--muted); font-size: 0.57rem; }
.trust-change i { height: 4px; background: var(--line); }
.trust-change i b { display: block; height: 100%; background: var(--muted); }
.trust-change i b.after { background: var(--mint); }
.trust-change strong { font-size: 0.6rem; text-align: right; }
.effect-card > p { margin: 15px 24px 0; color: var(--muted); font-size: 0.62rem; line-height: 1.55; }
.group-outcomes { display: grid; grid-template-columns: 1fr 1fr; overflow: hidden; }
.outcome-column { display: grid; gap: 8px; align-content: start; padding: 20px 22px; }
.outcome-column + .outcome-column { border-left: 1px solid var(--line); }
.outcome-column span { margin-bottom: 4px; color: var(--muted); font-size: 0.6rem; }
.outcome-column strong { font-size: 0.69rem; font-weight: 600; }
.outcome-column.updated strong::before { content: '✓'; margin-right: 7px; color: var(--mint); }
.outcome-column.unresolved strong::before { content: '·'; margin-right: 7px; color: var(--orange); }

.transfer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.transfer-grid > button { padding: 25px; border: 1px solid var(--line); border-radius: 14px; color: var(--text); background: var(--panel); text-align: left; cursor: pointer; }
.transfer-grid > button:hover,
.transfer-grid > button:focus-visible,
.transfer-grid > button.active { border-color: var(--mint); background: var(--panel-2); outline: none; }
.transfer-grid header { display: grid; gap: 6px; }
.transfer-grid header span { color: var(--mint); font-size: 0.6rem; }
.transfer-grid header strong { font-family: Georgia, "Songti SC", serif; font-size: 1.25rem; font-weight: 520; }
.mini-shape { height: 130px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; align-items: end; margin: 28px 0 20px; padding: 0 20px; border-bottom: 1px solid var(--line); }
.mini-shape div { height: 100%; display: grid; grid-template-rows: 1fr auto; gap: 8px; align-items: end; justify-items: center; }
.mini-shape i { width: min(36px, 58%); min-height: 4px; background: linear-gradient(180deg, var(--mint), rgba(115, 226, 183, 0.25)); }
.mini-shape span { padding-bottom: 7px; color: var(--muted); font-size: 0.57rem; }
.transfer-grid footer { display: flex; justify-content: space-between; gap: 16px; color: var(--muted); font-size: 0.62rem; }
.transfer-grid footer b { color: var(--text); }

.evidence-grid { display: grid; grid-template-columns: 1.1fr 0.85fr 0.85fr; gap: 16px; }
.review-card,
.claim-card { padding: 27px; }
.review-number { color: var(--mint); font-family: Georgia, serif; font-size: 4.8rem; line-height: 1; letter-spacing: -0.05em; }
.review-card > p { margin: 8px 0 22px; font-family: Georgia, "Songti SC", serif; font-size: 1.05rem; line-height: 1.5; }
.review-card ul,
.claim-card ul { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.review-card li { color: var(--muted); font-size: 0.68rem; line-height: 1.55; }
.review-card li::before { content: '—'; margin-right: 7px; color: var(--mint); }
.claim-card header { display: flex; gap: 10px; align-items: center; margin-bottom: 24px; }
.claim-card header i { width: 27px; height: 27px; display: grid; place-items: center; border-radius: 50%; color: #07110f; background: var(--mint); font-style: normal; }
.claim-card header span { font-size: 0.75rem; font-weight: 700; }
.claim-card li { padding: 11px 0; border-bottom: 1px solid var(--line); font-size: 0.7rem; }
.claim-card.rejected header i { background: var(--orange); }
.limitation-note { display: grid; grid-template-columns: 160px 1fr 0.9fr; gap: 24px; align-items: center; margin-top: 16px; padding: 17px 22px; border-left: 3px solid var(--orange); background: rgba(255, 152, 102, 0.08); }
.limitation-note strong { color: var(--orange); font-size: 0.68rem; }
.limitation-note p { margin: 0; font-size: 0.69rem; line-height: 1.5; }
.limitation-note span { color: var(--muted); font-size: 0.61rem; line-height: 1.5; }

.page-footer { display: grid; grid-template-columns: 0.7fr 1.4fr auto; gap: 30px; align-items: center; margin-top: 100px; padding: 30px 0; border-top: 1px solid var(--line); color: var(--muted); }
.page-footer > div { display: grid; gap: 3px; }
.page-footer strong { color: var(--text); font-size: 0.82rem; }
.page-footer div span,
.page-footer > span { font-size: 0.58rem; }
.page-footer p { margin: 0; font-size: 0.6rem; line-height: 1.55; text-align: center; }

.loading-state { min-height: calc(100vh - 77px); display: grid; place-items: center; text-align: center; }
.loader { display: grid; gap: 16px; justify-items: center; color: var(--muted); font-size: 0.74rem; }
.loader i { width: 38px; height: 38px; border: 2px solid var(--line); border-top-color: var(--mint); border-radius: 50%; animation: spin 0.8s linear infinite; }
.load-error p { color: var(--muted); }
.load-error button { padding: 9px 15px; border: 0; border-radius: 6px; color: #07110f; background: var(--mint); cursor: pointer; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 0% { transform: scale(0.7); opacity: 0.55; } 100% { transform: scale(1.25); opacity: 0; } }

@media (max-width: 1180px) {
  .hero { grid-template-columns: 1fr minmax(340px, 0.58fr); gap: 50px; }
  .population-workspace { grid-template-columns: 1.3fr 0.7fr; }
  .archetype-list { grid-column: 1 / -1; max-height: none; display: grid; grid-template-columns: repeat(4, 1fr); }
  .background-mass { grid-column: span 2; }
  .simulation-grid { grid-template-columns: 1fr; }
  .phase-card { display: grid; grid-template-columns: 0.8fr 1fr; gap: 0 28px; }
  .phase-card-top,
  .phase-story,
  .seed-comparison { grid-column: 1; }
  .phase-kpis,
  .topic-mix { grid-column: 2; }
  .phase-kpis { grid-row: 1 / 3; margin-top: 0; }
  .topic-mix { grid-row: 3 / 5; }
}

@media (max-width: 900px) {
  .topbar,
  .page { width: min(100% - 34px, 1440px); }
  .topbar { grid-template-columns: 1fr auto; }
  .brand { justify-self: end; margin-right: 60px; }
  .snapshot { display: none; }
  .hero,
  .section-heading { grid-template-columns: 1fr; }
  .hero-console { max-width: 580px; }
  .metric-rail { grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .metric-rail .rail-arrow { display: none; }
  .metric-rail article { display: grid; grid-template-columns: 1fr; }
  .population-workspace { grid-template-columns: 1fr; }
  .archetype-list { grid-column: auto; grid-template-columns: repeat(2, 1fr); }
  .background-mass { grid-column: span 2; }
  .fidelity-lab-header { grid-template-columns: 1fr; }
  .fidelity-scoreboard { width: 100%; }
  .gate-acceptance-strip { grid-template-columns: 1fr; }
  .gate-acceptance-strip dl > div:first-child { border-left: 0; padding-left: 0; }
  .fidelity-tabs { grid-template-columns: 1fr 1fr; }
  .fidelity-trajectories { grid-template-columns: 1fr; }
  .fidelity-trajectories > i { transform: rotate(90deg); }
  .gate-repair-flow { grid-template-columns: 1fr; }
  .gate-repair-flow > i { transform: rotate(90deg); }
  .fidelity-boundary { grid-template-columns: 72px 1fr; }
  .fidelity-boundary small { grid-column: 2; text-align: left; }
  .phase-navigator { grid-template-columns: repeat(4, 1fr); }
  .play-button { grid-column: 1 / -1; padding: 11px; }
  .shape-proof { grid-template-columns: 1fr 1fr; }
  .shape-proof dl { grid-column: 1 / -1; }
  .expression-grid { grid-template-columns: 1fr; }
  .thread-grid { grid-template-columns: 1fr; }
  .function-rate-grid { grid-template-columns: 1fr 1fr; }
  .branch-actor > header { grid-template-columns: 1fr; gap: 7px; }
  .branch-actor > header p { text-align: left; }
  .orchestration-layout { grid-template-columns: 1fr; }
  .orchestration-timeline { border-right: 0; border-bottom: 1px solid var(--line); }
  .governance-grid,
  .evidence-grid { grid-template-columns: 1fr; }
  .policy-package { grid-row: auto; }
  .transfer-grid { grid-template-columns: 1fr; }
  .limitation-note { grid-template-columns: 1fr; gap: 9px; }
  .page-footer { grid-template-columns: 1fr; text-align: center; }
}

@media (max-width: 620px) {
  .page { padding-top: 45px; }
  h1 { font-size: 2.55rem; }
  .hero-actions { align-items: stretch; flex-direction: column; }
  .primary-action { justify-content: space-between; }
  .text-action { width: max-content; }
  .metric-rail { grid-template-columns: 1fr 1fr; padding-inline: 8px; }
  .metric-rail article { padding: 9px; }
  .metric-rail .reviewed-metric { grid-column: 1 / -1; }
  .section { padding-top: 82px; }
  .section-heading { gap: 20px; margin-bottom: 30px; }
  .section-heading h2 { font-size: 2rem; }
  .agent-map { grid-template-columns: repeat(6, 1fr); gap: 8px; }
  .map-header { align-items: start; flex-direction: column; }
  .archetype-list { grid-template-columns: 1fr; }
  .background-mass { grid-column: auto; }
  .fidelity-lab-header,
  .fidelity-case { padding: 19px 16px; }
  .gate-acceptance-strip { margin-inline: 16px; padding: 15px; }
  .gate-acceptance-strip dl { grid-template-columns: 1fr; gap: 9px; }
  .gate-acceptance-strip dl > div { padding: 8px 0 0; border-top: 1px solid var(--line); border-left: 0; }
  .gate-acceptance-strip dl > div:first-child { padding-top: 0; border-top: 0; }
  .fidelity-scoreboard { grid-template-columns: 1fr 1fr; }
  .fidelity-scoreboard div:nth-child(3) { border-top: 1px solid var(--line); border-left: 0; }
  .fidelity-scoreboard div:nth-child(4) { border-top: 1px solid var(--line); }
  .fidelity-tabs { grid-template-columns: 1fr; }
  .fidelity-claim { grid-template-columns: 1fr; gap: 7px; }
  .fidelity-case > header { align-items: flex-start; flex-direction: column; }
  .fidelity-case > header .fidelity-rating { justify-content: flex-start; }
  .fidelity-boundary { grid-template-columns: 1fr; gap: 6px; padding-inline: 16px; }
  .fidelity-boundary small { grid-column: auto; }
  .phase-navigator { grid-template-columns: 1fr 1fr; }
  .phase-navigator > button:not(.play-button) { padding: 12px; }
  .phase-card,
  .transcript-card { padding: 20px 16px; }
  .expression-proof { grid-template-columns: 1fr 1fr; gap: 14px; }
  .expression-proof > i { display: none; }
  .expression-boundary { grid-template-columns: 1fr; gap: 8px; }
  .thread-proof { grid-template-columns: 1fr 1fr; }
  .function-evidence > header { align-items: start; flex-direction: column; gap: 8px; }
  .function-rate-grid { grid-template-columns: 1fr; }
  .phase-card { display: block; }
  .phase-kpis { margin-top: 22px; }
  .transcript-head { flex-direction: column; }
  .policy-switch { width: 100%; }
  .policy-switch button { flex: 1; }
  .message-feed { min-height: 0; }
  .message-item { grid-template-columns: 32px 1fr; padding-inline: 6px; }
  .agent-avatar { width: 30px; height: 30px; border-radius: 8px; }
  .message-item header small { display: none; }
  .transcript-card > footer { align-items: start; flex-direction: column; }
  .shape-proof { grid-template-columns: 1fr; gap: 22px; }
  .shape-proof dl { grid-column: auto; }
  .effect-comparison { padding-inline: 16px; }
  .branch-lab-head { align-items: stretch; flex-direction: column; }
  .branch-case-switch { width: 100%; }
  .branch-case-switch button { flex: 1; }
  .branch-common-root { margin-inline: 16px; }
  .branch-actor-list { padding-inline: 16px; }
  .branch-reaction-pair { grid-template-columns: 1fr; }
  .branch-reaction-pair > i { transform: rotate(90deg); }
  .governance-branch-lab > footer { grid-template-columns: 1fr; gap: 6px; padding-inline: 16px; }
  .orchestration-head { align-items: stretch; flex-direction: column; padding-inline: 18px; }
  .orchestration-head > strong { width: max-content; }
  .orchestration-facts { grid-template-columns: 1fr 1fr; }
  .orchestration-facts > div { padding: 14px 16px; }
  .orchestration-facts > div:nth-child(3) { border-top: 1px solid var(--line); border-left: 0; }
  .orchestration-facts > div:nth-child(4) { border-top: 1px solid var(--line); }
  .orchestration-timeline { grid-template-columns: 1fr; padding: 16px; }
  .step-copy > p { min-height: 0; }
  .comparison-contract dl { grid-template-columns: 1fr; }
  .orchestration-board > footer { grid-template-columns: 1fr; gap: 6px; padding-inline: 18px; }
  .group-outcomes { grid-template-columns: 1fr; }
  .outcome-column + .outcome-column { border-top: 1px solid var(--line); border-left: 0; }
  .transfer-grid > button { padding: 20px 16px; }
  .page-footer { margin-top: 70px; }
}

@media (prefers-reduced-motion: reduce) {
  .phase-pulse i,
  .loader i { animation: none; }
  .agent-dot,
  .message-enter-active,
  .message-leave-active { transition: none; }
}
</style>
