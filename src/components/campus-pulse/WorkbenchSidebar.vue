<script setup>
defineProps({
  active: {
    type: String,
    default: 'overview',
  },
})

const modules = [
  { id: 'overview', icon: 'fa-chart-pie', label: '产品总览', to: '/campus-pulse' },
  { id: 'forum', icon: 'fa-comments', label: '平行论坛', to: '/campus-pulse/forum' },
  { id: 'results', icon: 'fa-chart-line', label: '结果中心', to: '/campus-pulse/results' },
  { id: 'workbench', icon: 'fa-sliders', label: '运行工作台', to: '/campus-pulse/workbench' },
  { id: 'system', icon: 'fa-diagram-project', label: '系统与证据', to: '/campus-pulse/system' },
]
</script>

<template>
  <aside class="workbench-sidebar">
    <router-link class="brand" to="/campus-pulse">
      <span class="brand-mark"><i class="fa-solid fa-bullhorn" /></span>
      <span>
        <strong>校园小喇叭</strong>
        <small>CAMPUSPULSE · FORUMTWIN</small>
      </span>
    </router-link>

    <nav aria-label="CampusPulse 产品模块">
      <router-link
        v-for="module in modules"
        :key="module.id"
        class="nav-item"
        :class="{ active: active === module.id }"
        :to="module.to"
      >
        <i class="fa-solid" :class="module.icon" />
        <span class="nav-label">{{ module.label }}</span>
      </router-link>
    </nav>

    <div class="sidebar-boundary">
      <span>LLM-FIRST HYBRID</span>
      <strong>1,000 LLM Agents</strong>
      <p>公开论坛内容 100% 来自真实 LLM 或受审 trace；后台模型只处理阅读、队列和状态粒子。</p>
    </div>

    <router-link class="demo-link" to="/campus-pulse/forum">
      <span>进入比赛主演示</span>
      <i class="fa-solid fa-arrow-right" aria-hidden="true" />
    </router-link>
  </aside>
</template>

<style scoped>
.workbench-sidebar {
  background: #050505;
  border-right: 1px solid #1f1f1f;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 0;
  position: sticky;
  top: 0;
  z-index: 20;
}

.brand {
  align-items: center;
  border-bottom: 1px solid #242424;
  color: #ffffff;
  display: flex;
  gap: 0.78rem;
  min-height: 88px;
  padding: 0 1.15rem;
  text-decoration: none;
}

.brand-mark {
  align-items: center;
  background: #ae0b2a;
  color: #ffffff;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 1.05rem;
  height: 2.8rem;
  justify-content: center;
  width: 2.8rem;
}

.brand strong,
.brand small,
.sidebar-boundary span,
.sidebar-boundary strong {
  display: block;
}

.brand strong {
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 1rem;
  letter-spacing: 0.06em;
}

.brand small {
  color: #757575;
  font: 700 0.55rem/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.1em;
  margin-top: 0.25rem;
}

nav {
  display: grid;
  gap: 0.22rem;
  padding: 1.1rem 0.7rem;
}

.nav-item {
  align-items: center;
  border-left: 3px solid transparent;
  color: #8c8c8c;
  display: grid;
  font-size: 0.82rem;
  font-weight: 650;
  gap: 0.72rem;
  grid-template-columns: 1.25rem 1fr;
  padding: 0.86rem 0.84rem;
  text-decoration: none;
  transition: 0.18s ease;
}

.nav-item:hover {
  background: #161616;
  color: #ffffff;
}

.nav-item.active {
  background: #ae0b2a;
  border-left-color: #e6c76a;
  color: #ffffff;
}

.nav-item i {
  text-align: center;
}

.sidebar-boundary {
  border-top: 1px solid #242424;
  color: #777777;
  margin-top: auto;
  padding: 1.15rem 1.2rem;
}

.sidebar-boundary span {
  color: #9b8a5c;
  font: 800 0.58rem ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.12em;
}

.sidebar-boundary strong {
  color: #ffffff;
  font-size: 1rem;
  margin-top: 0.45rem;
}

.sidebar-boundary p {
  font-size: 0.67rem;
  line-height: 1.7;
  margin: 0.45rem 0 0;
}

.demo-link {
  align-items: center;
  border-top: 1px solid #242424;
  color: #d6d6d6;
  display: flex;
  font-size: 0.72rem;
  justify-content: space-between;
  padding: 1rem 1.2rem;
  text-decoration: none;
}

.demo-link:hover { color: #ffffff; }

@media (max-width: 900px) {
  .workbench-sidebar {
    border-bottom: 1px solid #242424;
    border-right: 0;
    min-height: 0;
    position: static;
  }

  .brand { min-height: 68px; }

  nav {
    display: flex;
    overflow-x: auto;
    padding: 0.55rem 0.7rem;
  }

  .nav-item {
    flex: 0 0 auto;
    padding: 0.7rem 0.9rem;
  }

  .sidebar-boundary,
  .demo-link { display: none; }
}
</style>
