import { Alert, Box, Typography, styled } from 'decentraland-ui2'

const SummaryBody = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(4),
  textAlign: 'left',
  width: '100%'
}))

const CallLine = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(15),
  marginTop: theme.spacing(2),
  textAlign: 'left',
  width: '100%'
}))

const PreviewUnavailableWarning = styled(Alert)(({ theme }) => ({
  marginTop: theme.spacing(2),
  textAlign: 'left',
  width: '100%'
}))

const DeferredCallbackWarning = styled(Alert)(({ theme }) => ({
  marginTop: theme.spacing(2),
  textAlign: 'left',
  width: '100%'
}))

export { CallLine, DeferredCallbackWarning, PreviewUnavailableWarning, SummaryBody }
