import { styled, Box, Logo, Typography } from 'decentraland-ui2'

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

const TextWrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  marginBottom: theme.spacing(9)
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

const TroubleSigningInText = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(4),
  marginBottom: theme.spacing(4),
  fontWeight: '500',
  fontStyle: 'Medium',
  fontSize: '24px',
  lineHeight: '133%',
  letterSpacing: '0px',
  textAlign: 'left'
}))

const ErrorButtonContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: theme.spacing(4),
  marginBottom: theme.spacing(4)
}))

const ProgressContainer = styled(Box)({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  color: 'rgb(235,68,90)'
})

export { ConnectionContainer, DecentralandLogo, TextWrapper, ConnectionTitle, TroubleSigningInText, ProgressContainer, ErrorButtonContainer }
