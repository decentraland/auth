import { styled, Box, Logo, Typography } from 'decentraland-ui2'
import CustomWelcomeBackground from '../../assets/images/background/custom-welcome-background.webp'

const MainContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  display: 'flex',
  height: '100vh',
  width: '100vw',
  backgroundImage: `url(${CustomWelcomeBackground})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  zIndex: theme.zIndex.modal
}))

const LoadingContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  marginLeft: 'auto',
  marginRight: 'auto'
})

const DecentralandLogo = styled(Logo)({
  fontSize: '63px',
  marginBottom: '32px'
})

const LoadingTitle = styled(Typography)({
  marginTop: '76px',
  marginBottom: '42px',
  fontWeight: '500',
  fontStyle: 'Medium',
  fontSize: '24px',
  lineHeight: '133%',
  letterSpacing: '0px',
  textAlign: 'center',
  verticalAlign: 'middle'
})

const ErrorButtonContainer = styled(Box)({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: '24px'
})
const ProgressContainer = styled(Box)({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  color: 'rgb(235,68,90)'
})

export { MainContainer, LoadingContainer, DecentralandLogo, LoadingTitle, ProgressContainer, ErrorButtonContainer }
