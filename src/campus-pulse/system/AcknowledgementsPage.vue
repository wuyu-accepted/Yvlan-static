<script setup lang="ts">
import { computed } from 'vue'
import { currentLocale } from '../i18n/locale.ts'
const english = computed(() => currentLocale.value === 'en-US')
const l = (zh:string,en:string) => english.value ? en : zh
const publicDemo = import.meta.env.VITE_PUBLIC_DEMO === 'true'
const members = ['景年泽', '卢修良', '朱照宇', 'Daria Mikhalkina', '原琪林']
</script>

<template>
  <main class="acknowledgements" data-no-localize>
    <header><span>CAMPUSPULSE · PEOPLE & CREDITS</span><h1>{{ l('团队与致谢','Team & acknowledgements') }}</h1><p>{{ l('让公共服务的每一次改变，都有可追溯的推演依据。','Making public-service decisions informed by traceable simulation.') }}</p></header>
    <section aria-labelledby="team-title"><div class="section-label">01 · {{ l('团队','TEAM') }}</div><h2 id="team-title">CampusPulse</h2><ul><li v-for="member in members" :key="member">{{ member }}</li></ul></section>
    <section aria-labelledby="credits-title"><div class="section-label">02 · {{ l('开源基础','OPEN-SOURCE FOUNDATION') }}</div><h2 id="credits-title">{{ l('玉兰-万象 · YuLan-OneSim','YuLan-OneSim · 玉兰-万象') }}</h2><p>{{ l('感谢中国人民大学玉兰-万象团队开放 YuLan-OneSim。CampusPulse 在其开源代码工程上扩展校园治理应用，保留通用框架及启动入口，并由 CampusPulse 团队开发 ForumTwin 论坛模拟执行器、人物与关系建模、公私传播机制和治理评估。','We thank the YuLan-OneSim team at Renmin University of China for their open-source work. CampusPulse extends the YuLan-OneSim codebase with a campus-governance application, retaining its general framework and entry points. The CampusPulse team develops the ForumTwin simulation executor, persona and relationship models, public and private propagation, and governance evaluation.') }}</p><p>{{ publicDemo ? l('本网站集中展示经过整理的公开案例。我们希望以可复用的校园论坛机制，为玉兰-万象的社会模拟生态补充新的应用场景。','This site presents a curated collection of public cases. Our reusable campus-forum mechanisms contribute an additional application domain to the YuLan-OneSim social-simulation ecosystem.') : l('校园案例由 ForumTwin 执行器完成。我们希望以可复用的校园论坛机制，为玉兰-万象的社会模拟生态补充新的应用场景。','Campus scenarios are produced with the ForumTwin executor. Our reusable campus-forum mechanisms contribute an additional application domain to the YuLan-OneSim social-simulation ecosystem.') }}</p><a href="https://github.com/RUC-GSAI/YuLan-OneSim" target="_blank" rel="noopener noreferrer">{{ l('访问 YuLan-OneSim 开源项目','Explore YuLan-OneSim') }} ↗</a></section>
    <footer>CampusPulse · {{ l('校园社会治理模拟与推演','Campus governance simulation') }}</footer>
  </main>
</template>

<style scoped>
.acknowledgements{max-width:1050px;margin:auto;padding:40px 32px 64px;color:var(--cp-text-primary)}header{padding:32px;border-left:4px solid #b80031;background:var(--cp-surface-default)}header>span,.section-label{font-size:11px;letter-spacing:.12em;color:#b80031;font-weight:700}h1{font-size:30px;margin:16px 0}h2{font-size:24px;margin:16px 0}p{font-size:15px;line-height:1.9;color:var(--cp-text-secondary);max-width:850px}section{padding:36px 0;border-bottom:1px solid var(--cp-border-default)}ul{padding:0;display:flex;flex-wrap:wrap;gap:12px;list-style:none}li{padding:16px 22px;background:var(--cp-surface-default);border:1px solid var(--cp-border-default);border-bottom:2px solid #b80031;font-size:17px;transition:transform 160ms ease,border-color 160ms ease}li:hover{transform:translateY(-3px);border-color:#b80031}a{color:#b80031;text-underline-offset:4px}a:focus-visible{outline:2px solid #b80031;outline-offset:4px}footer{padding-top:32px;font-size:12px;color:var(--cp-text-secondary)}@media(max-width:600px){.acknowledgements{padding:24px 16px}header{padding:22px}h1{font-size:25px}li{flex:1 1 40%;font-size:15px}}@media(prefers-reduced-motion:reduce){li{transition:none}li:hover{transform:none}}
</style>
