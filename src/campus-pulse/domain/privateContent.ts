import type {
  PrivateActivityAggregateViewModel,
  PrivateConversationViewModel,
} from './viewModels.ts'

export class PrivateContentContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PrivateContentContractError'
  }
}

export function canInspectPrivateConversation(value: PrivateConversationViewModel): boolean {
  return value.inspectable
    && value.access !== 'aggregate_only'
    && value.access !== 'unavailable'
    && value.provenance !== 'aggregate_only'
    && Boolean(value.id)
    && value.messages.length > 0
    && value.messages.every((message) => Boolean(message.id && message.text.trim()))
}

export function assertInspectablePrivateConversation(
  value: PrivateConversationViewModel,
): PrivateConversationViewModel {
  if (!canInspectPrivateConversation(value)) {
    throw new PrivateContentContractError(
      'Private conversation requires a stable identifier, approved provenance and non-empty record-level messages.',
    )
  }
  return value
}

export function aggregatePrivateActivity(
  value: Omit<PrivateActivityAggregateViewModel, 'access' | 'inspectable'>,
): PrivateActivityAggregateViewModel {
  return { ...value, access: 'aggregate_only', inspectable: false }
}

