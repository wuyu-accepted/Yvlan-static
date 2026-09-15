export const AGENT_ROLE_NAMES_EN: Record<string, string> = {
  'archetype-01': 'Rule verifier',
  'archetype-02': 'Learning-help seeker',
  'archetype-03': 'Campus procedure inquirer',
  'archetype-04': 'Public-service complainant',
  'archetype-05': 'Opportunity adviser',
  'archetype-06': 'Opportunity recruiter',
  'archetype-07': 'Daily-life solution seeker',
  'archetype-08': 'Marketplace promoter',
  'archetype-09': 'High-risk marketplace signal',
  'archetype-10': 'Social peer matcher',
  'archetype-11': 'Task-resource matcher',
  'archetype-12': 'Collaboration boundary negotiator',
  'archetype-13': 'Emotional supporter',
  'archetype-14': 'Public-norm discussant',
  'archetype-15': 'Community experience sharer',
  'archetype-16': 'Context-ambiguous performer',
  'archetype-17': 'Wellbeing help seeker',
}

const MICRO_ROLE_ACTIONS_EN: Record<string, string> = {
  complaint: 'Complaint',
  discussion: 'Discussion',
  emotional_expression: 'Emotional expression',
  help_request: 'Help request',
  information_share: 'Information sharing',
  other: 'Other',
  question: 'Question',
  request: 'Request',
}

export function agentRoleLabel(roleId: string, sourceLabel: string, english: boolean): string {
  return english ? (AGENT_ROLE_NAMES_EN[roleId] || roleId || sourceLabel) : sourceLabel
}

export function agentMicroRoleLabel(
  microRole: string,
  roleId: string,
  sourceRoleLabel: string,
  english: boolean,
): string {
  if (!english) return microRole
  const role = agentRoleLabel(roleId, sourceRoleLabel, true)
  const match = microRole.match(/_([a-z_]+)_(\d+)$/)
  if (!match) return role
  const action = MICRO_ROLE_ACTIONS_EN[match[1]] || match[1].replaceAll('_', ' ')
  return `${role} · ${action} ${match[2]}`
}
