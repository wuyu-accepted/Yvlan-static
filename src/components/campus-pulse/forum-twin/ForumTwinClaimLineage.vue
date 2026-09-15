<script setup lang="ts">
import { computed } from 'vue'
import type { ForumBranchId, ForumClaim } from '../../../services/forumTwin'

const props = defineProps<{
  claims: ForumClaim[]
  scenarioId: string
  branchId: ForumBranchId
  tick: number
  selectedClaimId?: string
}>()

const emit = defineEmits<{
  selectClaim: [claimId: string]
}>()

const visible = computed(() => props.claims
  .filter((claim) => (
    claim.scenario_id === props.scenarioId
    && claim.branch_id === props.branchId
    && claim.first_seen_tick <= props.tick
  ))
  .sort((left, right) => (
    left.first_seen_tick - right.first_seen_tick
    || left.claim_id.localeCompare(right.claim_id)
  )))

const depth = computed(() => {
  const byId = new Map(visible.value.map((claim) => [claim.claim_id, claim]))
  const result = new Map<string, number>()
  visible.value.forEach((claim) => {
    let cursor = claim
    let level = 0
    const seen = new Set<string>()
    while (cursor.parent_claim_id && byId.has(cursor.parent_claim_id)) {
      if (seen.has(cursor.claim_id)) break
      seen.add(cursor.claim_id)
      level += 1
      cursor = byId.get(cursor.parent_claim_id)!
    }
    result.set(claim.claim_id, level)
  })
  return result
})

function statusLabel(status: string) {
  return ({
    unverified: '未核验', contested: '有争议', corrected: '已纠错',
    verified: '已核验', expired: '已过期',
  } as Record<string, string>)[status] || status
}
</script>

<template>
  <section class="claim-lineage">
    <header>
      <div>
        <span>CLAIM / CORRECTION LINEAGE</span>
        <h2>主张如何分叉、被质疑和纠正</h2>
      </div>
      <b>{{ branchId === 'natural' ? 'NATURAL' : 'ADAPTIVE D' }}</b>
    </header>
    <div v-if="visible.length" class="claim-list">
      <button
        v-for="claim in visible"
        :key="claim.claim_id"
        type="button"
        :class="['claim', claim.status, { selected: claim.claim_id === selectedClaimId }]"
        :style="{ '--depth': depth.get(claim.claim_id) || 0 }"
        @click="emit('selectClaim', claim.claim_id)"
      >
        <i />
        <span>
          <em>T{{ claim.first_seen_tick }} · {{ statusLabel(claim.status) }}</em>
          <strong>{{ claim.summary }}</strong>
          <small v-if="claim.correction_target_claim_id">
            纠错目标 {{ claim.correction_target_claim_id }}
          </small>
        </span>
        <b>{{ claim.supporting_message_ids.length }} / {{ claim.challenging_message_ids.length }}</b>
      </button>
    </div>
    <p v-else>当前时点没有通过公开审阅的 claim。</p>
  </section>
</template>

<style scoped>
.claim-lineage { min-width:0; padding:17px; border:1px solid rgba(102,158,165,.15); border-radius:15px; background:rgba(6,19,23,.9); }
header { display:flex; justify-content:space-between; gap:12px; align-items:center; }
header span { color:#56d9c7; font:800 9px ui-monospace,monospace; letter-spacing:.13em; }
h2 { margin:4px 0 0; color:#e3efed; font-size:16px; }
header > b { color:#a78fda; font:800 9px ui-monospace,monospace; }
.claim-list { display:grid; gap:6px; margin-top:14px; }
.claim { box-sizing:border-box; display:grid; grid-template-columns:10px minmax(0,1fr) auto; gap:10px; align-items:center; width:calc(100% - min(calc(var(--depth) * 20px),80px)); margin-left:min(calc(var(--depth) * 20px),80px); padding:10px; border:1px solid rgba(95,150,156,.12); border-radius:9px; background:#08181c; color:inherit; text-align:left; cursor:pointer; }
.claim:hover,.claim.selected { border-color:rgba(79,219,201,.45); }
.claim > i { width:7px; height:7px; border-radius:50%; background:#91a3a5; box-shadow:0 0 0 3px rgba(145,163,165,.1); }
.claim.contested > i { background:#f0a86b; }
.claim.corrected > i,.claim.verified > i { background:#54ddc9; }
.claim > span { display:grid; gap:4px; min-width:0; }
.claim em,.claim small { color:#607b80; font-size:8px; font-style:normal; }
.claim strong { overflow:hidden; color:#cddfdd; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
.claim > b { color:#71898e; font:700 8px ui-monospace,monospace; }
.claim-lineage > p { margin:30px 0 10px; color:#667e83; font-size:9px; text-align:center; }
</style>

<style scoped>
.claim-lineage { border: 1px solid var(--ft-border); border-top: 4px solid var(--ft-red); border-radius: 2px; background: #ffffff; box-shadow: 0 5px 18px rgba(0,0,0,.035); }
header span { color: var(--ft-red); }
h2 { color: var(--ft-ink); font-weight: 600; }
header > b { color: var(--ft-red); }
.claim { border-color: #e8e8e8; border-radius: 2px; background: #fafafa; }
.claim:hover,
.claim.selected { border-color: var(--ft-red); box-shadow: inset 3px 0 var(--ft-red); }
.claim > i { background: #bfbfbf; box-shadow: 0 0 0 3px #eeeeee; }
.claim.contested > i { background: #d4880f; }
.claim.corrected > i,
.claim.verified > i { background: #2f9e44; }
.claim em,
.claim small { color: var(--ft-muted); }
.claim strong { color: var(--ft-copy); }
.claim > b { color: var(--ft-gold); }
.claim-lineage > p { color: var(--ft-muted); }
</style>
