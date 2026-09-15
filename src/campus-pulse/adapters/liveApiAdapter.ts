import type { ForumTwinLoaded } from '../contracts/forumTwin.ts'
import type { ForumTwinV2Loaded } from '../../services/forumTwinV2.ts'
import { isForumTwinV2Loaded } from '../../services/forumTwinV2.ts'
import {
  adaptFormalResult,
  adaptForumTwinV2Result,
  type ResultViewModel,
} from '../source/forumTwinAdapter.ts'
import {
  planContractFromRun,
  policyListFromPayload,
  projectFromPayload,
  runFromPayload,
  scenarioListFromPayload,
} from '../workbench/workbenchViewModel.ts'
import type {
  CampusPulseDataAdapter,
  PrivateConversationViewModel,
  PolicyViewModel,
  ProjectViewModel,
  RunPlanViewModel,
  ScenarioViewModel,
} from '../domain/viewModels.ts'
import { assertInspectablePrivateConversation } from '../domain/privateContent.ts'
import { LIVE_SOURCE_KEY } from '../source/registry.ts'

function normalizedProjectStatus(value: unknown): ProjectViewModel['status'] {
  const status = String(value || '').toLowerCase()
  if (status === 'draft' || status === 'ready' || status === 'running' || status === 'paused' || status === 'succeeded' || status === 'failed') return status
  return 'unknown'
}

export class LiveApiAdapter implements CampusPulseDataAdapter {
  readonly kind = 'live_api' as const
  readonly sourceKey = LIVE_SOURCE_KEY
  readonly immutable = false

  project(payload: unknown): ProjectViewModel {
    const source = projectFromPayload(payload)
    if (!source) throw new TypeError('Live project payload has no project_id.')
    const row = payload as Record<string, unknown>
    return {
      id: source.project_id,
      name: source.name,
      governanceDomain: source.governance_domain,
      researchQuestion: source.objective,
      evaluationMode: source.evaluation_mode,
      status: normalizedProjectStatus(row.status),
      createdAt: source.created_at,
      updatedAt: source.updated_at,
    }
  }

  scenarios(payload: unknown): ScenarioViewModel[] {
    return scenarioListFromPayload(payload).map((item) => ({
      id: item.scenario_id,
      name: item.name,
      description: item.description,
      templateKey: item.template_key,
      evidenceStatus: item.evidence_binding_status,
    }))
  }

  policies(payload: unknown): PolicyViewModel[] {
    return policyListFromPayload(payload).map((item) => ({
      id: item.policy_id,
      name: item.name,
      description: item.description,
      templateKey: item.template_key,
      baseline: item.is_baseline === true,
      actionCount: item.action_count,
      actions: [],
    }))
  }

  runPlan(payload: unknown): RunPlanViewModel {
    const run = runFromPayload(payload)
    if (!run) throw new TypeError('Live run payload has no run_id.')
    const contract = planContractFromRun(payload)
    return {
      runId: run.run_id,
      projectId: run.project_id,
      scenarioId: run.scenario_id,
      status: run.effective_runtime_status || run.plan_status || run.status,
      executionMode: run.execution_mode,
      tokenBudget: run.token_budget,
      primarySlots: contract.primarySlots,
      requestLimit: contract.requestLimit,
      tickCount: contract.tickCount,
      fingerprint: run.input_fingerprint,
    }
  }

  privateConversation(payload: unknown): PrivateConversationViewModel {
    const row = (payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {}) as Record<string, any>
    if (row.operator_authorized !== true) throw new TypeError('Record-level private conversation requires operator authorization.')
    if (row.provenance !== 'live_llm' && row.provenance !== 'exact_replay') throw new TypeError('Live private conversation provenance is invalid.')
    const messages = Array.isArray(row.messages) ? row.messages.map((item: unknown) => {
      const message = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      return {
        id: String(message.message_id || ''),
        senderLabel: String(message.sender_display_id || message.sender_label || ''),
        text: String(message.visible_text || ''),
        tick: Number(message.tick),
        replyToId: typeof message.reply_to_message_id === 'string' ? message.reply_to_message_id : undefined,
        claimStatus: typeof message.claim_status === 'string' ? message.claim_status as any : undefined,
      }
    }) : []
    return assertInspectablePrivateConversation({
      id: String(row.conversation_id || ''),
      branch: String(row.branch || ''),
      tick: Number(row.tick),
      channel: row.channel === 'private_group' ? 'private_group' : 'private_direct',
      access: 'full_record',
      provenance: row.provenance,
      inspectable: true,
      sourceLabel: typeof row.source_display_id === 'string' ? row.source_display_id : undefined,
      targetLabel: typeof row.target_display_id === 'string' ? row.target_display_id : undefined,
      relationType: typeof row.relation_type === 'string' ? row.relation_type : undefined,
      publicSourceMessageId: typeof row.public_source_message_id === 'string' ? row.public_source_message_id : undefined,
      messages,
      boundaryNote: 'Synthetic Agent conversation visible to the current project operator; governance Agents cannot read it.',
    })
  }

  result(loaded: ForumTwinLoaded | ForumTwinV2Loaded, runId: string): ResultViewModel {
    return isForumTwinV2Loaded(loaded)
      ? adaptForumTwinV2Result(loaded)
      : adaptFormalResult(loaded, runId)
  }
}

export const liveApiAdapter = new LiveApiAdapter()
