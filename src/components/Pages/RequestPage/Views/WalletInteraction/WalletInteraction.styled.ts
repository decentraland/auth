import { Alert, Box, styled } from 'decentraland-ui2'

const SummaryBody = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(4),
  textAlign: 'left',
  width: '100%'
}))

const PreviewUnavailableWarning = styled(Alert)(({ theme }) => ({
  marginTop: theme.spacing(2),
  textAlign: 'left',
  width: '100%'
}))

export { PreviewUnavailableWarning, SummaryBody }
