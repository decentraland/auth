import { Box, Logo, Typography, styled } from 'decentraland-ui2'

const ConnectionContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  marginLeft: 'auto',
  marginRight: 'auto',
  maxWidth: '600px'
})

const DecentralandLogo = styled(Logo)(({ theme }) => ({
  marginTop: theme.spacing(-8),
  marginBottom: theme.spacing(4)
}))

const ConnectionTitle = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(4),
  marginBottom: theme.spacing(4),
  fontWeight: '500',
  fontStyle: 'Medium',
  fontSize: '24px',
  lineHeight: '133%',
  letterSpacing: '0px',
  textAlign: 'center',
  verticalAlign: 'middle'
}))

const ErrorButtonContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: theme.spacing(4),
  marginBottom: theme.spacing(4)
}))

const ProgressContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  color: 'rgb(235,68,90)',
  marginBottom: theme.spacing(3)
}))

const ErrorDetailContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  marginTop: theme.spacing(2),
  maxWidth: '500px'
}))

const ErrorDescription = styled(Typography)(({ theme }) => ({
  fontSize: '14px',
  lineHeight: '150%',
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(2)
}))

const ErrorDetail = styled(Typography)(({ theme }) => ({
  fontSize: '12px',
  lineHeight: '150%',
  color: theme.palette.text.primary,
  fontFamily: 'monospace',
  padding: theme.spacing(1, 2),
  backgroundColor: theme.palette.action.hover,
  borderRadius: theme.spacing(1),
  wordBreak: 'break-word'
}))

export {
  ConnectionContainer,
  DecentralandLogo,
  ConnectionTitle,
  ProgressContainer,
  ErrorButtonContainer,
  ErrorDetailContainer,
  ErrorDescription,
  ErrorDetail
}
