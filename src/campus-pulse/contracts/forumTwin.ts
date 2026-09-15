// Stable public boundary for ForumTwin feature modules. Views and source
// adapters consume the validated service contract through this single module.
export type {
  ForumBranchId,
  ForumClaim,
  ForumDisplayProfile,
  ForumMessage,
  ForumThread,
  ForumTick,
  ForumTwinDevelopmentStatus,
  ForumTwinDomainResult,
  ForumTwinLoaded,
  ForumTwinManifest,
} from '../../services/forumTwin.ts'

export {
  ForumTwinDataError,
  sealForumTwin,
  validateForumTwinAggregate,
  validateForumTwinDevelopmentStatus,
  validateForumTwinDomain,
  verifyForumTwinManifestHash,
  verifyForumTwinResultFileHash,
} from '../../services/forumTwin.ts'
