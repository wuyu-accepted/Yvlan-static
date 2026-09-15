<script setup lang="ts">
import { computed } from 'vue'
import CpPageHeader from '../components/CpPageHeader.vue'
import { currentLocale } from '../i18n/locale.ts'

const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh: string, en: string) => isEnglish.value ? en : zh
</script>

<template>
  <div class="live-evolution-landing">
    <CpPageHeader :title="l('实时演化', 'Live evolution')">
      <template #description>
        <p>{{ l('逐个 Tick 观察校园讨论、Agent 行为与治理行动如何演化。', 'Observe how campus conversations, agent behavior, and governance evolve Tick by Tick.') }}</p>
      </template>
    </CpPageHeader>

    <div class="live-evolution-options">
      <section class="audited-replay" aria-labelledby="audited-replay-title">
        <small>{{ l('审计回放', 'AUDITED REPLAY') }}</small>
        <h2 id="audited-replay-title">{{ l('世纪馆“幽灵预约”', 'Century Gym ghost-booking') }}</h2>
        <p>{{ l('展示实时执行控制台的已验证回放。', 'Verified replay demonstrating the Live Execution Console.') }}</p>
        <RouterLink class="primary-action" :to="{ name:'campus-pulse-century-gym-live' }">
          {{ l('打开审计演示', 'Open audited demo') }}
          <i class="fa-solid fa-arrow-right" aria-hidden="true" />
        </RouterLink>
      </section>

      <section class="scenario-previews" aria-labelledby="scenario-previews-title">
        <small>{{ l('展示视图', 'SHOWCASE VIEWS') }}</small>
        <h2 id="scenario-previews-title">{{ l('场景预览', 'Scenario previews') }}</h2>
        <p>{{ l('用于展示场景行为与界面结构的预配置实时世界视图；它们不是用户项目的已完成运行。', 'Preconfigured live-world views for demonstrating scenario behavior and interface structure. These are not completed user-project runs.') }}</p>
        <div class="preview-list">
          <article>
            <small>{{ l('场景预览', 'Scenario preview') }}</small>
            <h3>{{ l('暑期住宿治理争议', 'Summer Housing governance dispute') }}</h3>
            <p>{{ l('校园资源分配治理争议的预配置视图。', 'Preconfigured view of a campus resource-allocation governance dispute.') }}</p>
            <RouterLink class="secondary-action" :to="{ name:'campus-pulse-live-world', query:{ scenario:'governance_legitimacy_dispute' } }">
              {{ l('打开场景预览', 'Open scenario preview') }}
              <i class="fa-solid fa-arrow-right" aria-hidden="true" />
            </RouterLink>
          </article>
          <article>
            <small>{{ l('场景预览', 'Scenario preview') }}</small>
            <h3>{{ l('讲座事件', 'Lecture incident') }}</h3>
            <p>{{ l('外部讲座事件及治理回应的预配置视图。', 'Preconfigured view of an external lecture incident and governance response.') }}</p>
            <RouterLink class="secondary-action" :to="{ name:'campus-pulse-live-world', query:{ scenario:'lecture_external_incident_shock' } }">
              {{ l('打开场景预览', 'Open scenario preview') }}
              <i class="fa-solid fa-arrow-right" aria-hidden="true" />
            </RouterLink>
          </article>
        </div>
      </section>

      <section class="project-workflow" aria-labelledby="project-live-title">
        <small>{{ l('项目工作流', 'PROJECT WORKFLOW') }}</small>
        <h2 id="project-live-title">{{ l('运行你自己的模拟', 'Run your own simulation') }}</h2>
        <p>{{ l('在工作台中创建并配置项目；场景、治理方案和运行合同就绪后，再启动真实运行。', 'Create and configure a project in Workbench, then launch a real run when its scenario, governance plan, and run contract are ready.') }}</p>
        <RouterLink class="secondary-action" :to="{ name:'campus-pulse-workbench' }">
          {{ l('打开项目工作台', 'Open Project Workbench') }}
          <i class="fa-solid fa-arrow-right" aria-hidden="true" />
        </RouterLink>
      </section>
    </div>
  </div>
</template>

<style scoped>
.live-evolution-landing { --cp-surface-default:var(--cp-surface-charcoal); --cp-surface-subtle:var(--cp-surface-charcoal-raised); --cp-text-primary:var(--cp-text-warm); --cp-text-secondary:var(--cp-text-warm-muted); --cp-text-muted:var(--cp-text-warm-muted); --cp-border-default:var(--cp-border-graphite); --cp-border-strong:color-mix(in srgb,var(--cp-text-warm-muted) 58%,var(--cp-border-graphite)); --cp-action-primary:var(--cp-accent-crimson); display:grid; box-sizing:border-box; width:min(100%,var(--cp-content-max)); min-height:calc(100vh - 7.5rem); align-content:start; gap:var(--cp-space-4); margin:0 auto; padding:var(--cp-space-4) var(--cp-content-gutter) var(--cp-space-8); background:var(--cp-canvas-obsidian); color:var(--cp-text-primary); color-scheme:dark; }
.live-evolution-landing :deep(.cp-page-header) { padding:var(--cp-space-4); }
.live-evolution-landing :deep(.cp-page-header h1) { font-size:var(--cp-text-2xl); }
.live-evolution-landing :deep(.cp-page-header p) { max-width:46rem; margin:var(--cp-space-2) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.6; }
.live-evolution-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--cp-space-3); }
.live-evolution-options section { display:grid; align-content:start; gap:var(--cp-space-2); padding:var(--cp-space-4); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-md); background:var(--cp-surface-default); }
.scenario-previews { grid-column:1 / -1; }
.preview-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--cp-space-3); margin-top:var(--cp-space-2); }
.preview-list article { display:grid; align-content:start; gap:var(--cp-space-2); padding:var(--cp-space-3); border-top:1px solid var(--cp-border-default); }
.live-evolution-options small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:750; letter-spacing:.07em; }
.live-evolution-options h2 { margin:0; color:var(--cp-text-primary); font-size:var(--cp-text-lg); }
.live-evolution-options h3 { margin:0; color:var(--cp-text-primary); font-size:var(--cp-text-md); }
.live-evolution-options p { min-height:2.8rem; margin:0 0 var(--cp-space-2); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.55; }
.live-evolution-options a { display:inline-flex; min-height:var(--cp-control-height); width:max-content; align-items:center; gap:var(--cp-space-2); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:700; text-decoration:none; }
.live-evolution-options .primary-action { border-color:var(--cp-action-primary); background:var(--cp-action-primary); color:var(--cp-text-inverse); }
.live-evolution-options .secondary-action:hover { border-color:var(--cp-action-primary); color:var(--cp-action-primary); }
.live-evolution-options a:focus-visible { outline:2px solid var(--cp-action-primary); outline-offset:2px; }
@media(max-width:767px) { .live-evolution-options,.preview-list { grid-template-columns:1fr; } .scenario-previews { grid-column:auto; } .live-evolution-options p { min-height:0; } }
</style>
