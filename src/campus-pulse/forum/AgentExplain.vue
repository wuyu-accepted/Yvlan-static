<script setup lang="ts">
import { computed } from 'vue'
import type { ForumDisplayProfile } from '../contracts/forumTwin.ts'
import type { AgentActivityVM } from './forumInvestigation.ts'

const props = defineProps<{
  displayId: string
  branch: 'natural' | 'A' | 'D' | 'both'
  activity: AgentActivityVM | null
  profile: ForumDisplayProfile | null
}>()

const branchLabel = computed(() => props.branch === 'D' ? '组合治理（方案 D）' : props.branch === 'A' ? '规则解释（方案 A）' : props.branch === 'both' ? '三个平行方案' : '不追加治理回应（Natural）')
</script>

<template>
  <div class="agent-explain">
    <header class="agent-head">
      <p>{{ branchLabel }}</p>
      <h3>{{ displayId }}</h3>
      <p class="synthetic-note"><strong>合成 Agent，不是真实学生。</strong>仅展示该运行已发布的公开字段。</p>
    </header>

    <dl v-if="activity" class="activity-facts">
      <div><dt>公开消息</dt><dd>{{ activity.messageCount }}</dd></div>
      <div><dt>活跃区间</dt><dd>Tick {{ activity.firstTick }} – Tick {{ activity.lastTick }}</dd></div>
      <div><dt>动作</dt><dd>{{ activity.actions.length ? activity.actions.join(' / ') : '未提供' }}</dd></div>
      <div><dt>话题</dt><dd>{{ activity.topics.length ? activity.topics.join(' / ') : '未提供' }}</dd></div>
    </dl>
    <p v-else class="agent-empty">该分支未记录该合成 Agent 的公开消息。</p>

    <template v-if="profile">
      <section class="profile-section" aria-labelledby="profile-title">
        <h4 id="profile-title">公开画像（该运行已发布）</h4>
        <dl class="profile-facts">
          <div><dt>宏观角色</dt><dd>{{ profile.macro_role }}</dd></div>
          <div><dt>微观角色</dt><dd>{{ profile.micro_role }}</dd></div>
          <div><dt>事件关注</dt><dd>{{ profile.episode_focus }}</dd></div>
          <div v-if="profile.topic_portfolio.length"><dt>话题组合</dt><dd>{{ profile.topic_portfolio.join(' / ') }}</dd></div>
          <div v-if="profile.need_portfolio.length"><dt>需求组合</dt><dd>{{ profile.need_portfolio.join(' / ') }}</dd></div>
          <div v-if="profile.interaction_style.length"><dt>交互风格</dt><dd>{{ profile.interaction_style.join(' / ') }}</dd></div>
        </dl>
      </section>
    </template>
    <p v-else class="profile-boundary">该运行未发布公开 agent profile；以下只能依据公开消息字段，不补画像。</p>

    <p class="privacy-note">隐私边界：不展示原始正文来源标识、私有向量索引或未发布个人信息。</p>
  </div>
</template>

<style scoped>
.agent-explain { display:grid; gap:var(--cp-space-3); }
.agent-head p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.agent-head h3 { margin:var(--cp-space-1) 0; font-size:var(--cp-text-md); word-break:break-all; }
.synthetic-note { color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.synthetic-note strong { color:var(--cp-text-primary); }
.activity-facts, .profile-facts { display:grid; gap:var(--cp-space-2); margin:0; padding:var(--cp-space-3); border:1px solid var(--cp-border-subtle); background:var(--cp-surface-subtle); }
.activity-facts div, .profile-facts div { display:flex; justify-content:space-between; gap:var(--cp-space-2); }
.activity-facts dt, .profile-facts dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.activity-facts dd, .profile-facts dd { margin:0; color:var(--cp-text-primary); font-size:var(--cp-text-xs); text-align:right; }
.agent-empty, .profile-boundary { margin:0; padding:var(--cp-space-2); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); border:1px dashed var(--cp-border-strong); }
.profile-section h4 { margin:0 0 var(--cp-space-2); font-size:var(--cp-text-sm); }
.privacy-note { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
</style>
