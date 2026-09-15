export interface PublicAgentProfile {
  historical_episode_focus: string
  topic_portfolio: string[]
  need_portfolio: string[]
  evidence_binding: string
}

export interface PublicAgentPersona {
  activity_rhythm: string
  attention_budget: number
  language_style: {
    language_form: string
    reply_function: string
    information_density: string
  }
  trust_style: Record<string, number>
  uncertainty_handling: string
  forum_tendencies: Record<string, number>
  behavior_boundaries: string[]
  safety_gates: string[]
}

export interface PublicAgentDossier {
  display_id: string
  role_id: string
  role_label: string
  micro_role: string
  profile: PublicAgentProfile
  persona: PublicAgentPersona
  memory: {
    long_term_seed: string
    recent_llm_episodes: string[]
    runtime_history_available: boolean
  }
  prompt_blueprint: {
    resident_turn_contract: string
    profile_and_persona_bound: boolean
    recent_llm_memory_max: number
    visible_public_context_max: number
    visible_private_context_max: number
    public_primary_actions_max: number
    independent_public_interactions_max: number
    parallel_private_actions_max: number
    public_anonymity_enabled?: boolean
    public_anonymity_semantics?: string
    same_tick_actions_are_parallel: boolean
    same_tick_commit_is_two_phase: boolean
  }
  project_override?: ProjectAgentProfileOverride | null
}

export interface ProjectAgentProfileOverride {
  roleDescription: string
  stableBackground: string
  topics: string
  needs: string
  expressionStyle: string
  judgementStyle: string
  participationStyle: string
  activityStyle: string
  behaviorBoundaries: string
  longTermMemory: string
  projectInstructions: string
}

export interface PublicAgentWorldNode {
  display_id: string
  role_id: string
  role_label: string
  micro_role: string
  attention_budget: number
  activity_tendency: number
  particle_uncertainty: number
  particle_count: number
}

export interface AgentDossierEvent {
  id: string
  tick: number
  channel: 'public' | 'private_direct' | 'private_group' | 'system'
  action: string
  text: string
  stance?: string | null
  emotion?: string | null
  evidenceStatus?: string | null
  promptHash?: string | null
  provenance?: string | null
  interactionCounts?: { like:number; repost:number; report:number } | null
}

export interface AgentDossierPrivateExcerpt {
  id: string
  tick: number
  channel: 'private_direct' | 'private_group'
  textZh: string
  textEn: string
  effectZh: string
  effectEn: string
}

export interface LiveAgentProfileOverlay {
  display_id: string
  macro_role: string
  micro_role?: string
  stable_traits?: string[]
  historical_episode_focus?: string
  topic_portfolio?: string[]
  need_portfolio?: string[]
  language_style?: { summary?: string; tendencies?: string[] }
}
