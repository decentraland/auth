import { Box, styled } from 'decentraland-ui2'

/**
 * MANA Transfer specific styled components
 * Most shared components are imported from SharedTransferComponents.styled.ts
 */
export {
  CenteredContent,
  Title,
  RecipientProfile,
  RecipientProfileText,
  Label as CreatorLabel,
  InfoAlert
} from '../SharedTransferComponents.styled'

// ============================================
// MANA TRANSFER SPECIFIC COMPONENTS
// ============================================

export const SceneImageWrapper = styled(Box)({
  width: '470px',
  height: '328px',
  marginBottom: '16px',
  borderRadius: '16px',
  overflow: 'hidden',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  }
})

export const SceneName = styled(Box)({
  fontSize: '30px',
  fontWeight: 600,
  marginBottom: '24px'
})
