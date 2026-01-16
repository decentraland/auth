import { Box, styled } from 'decentraland-ui2'

const SecondaryTextContainer = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  fontSize: theme.typography.pxToRem(24),
  gap: theme.spacing(2),
  justifyContent: 'center'
}))

export { SecondaryTextContainer }
