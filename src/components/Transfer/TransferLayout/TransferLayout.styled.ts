import { Box, styled } from 'decentraland-ui2'
import customWelcomeBackground from '../../../assets/images/background/custom-welcome-background.webp'

const Background = styled(Box)({
  backgroundImage: `url(${customWelcomeBackground})`,
  backgroundPosition: 'right',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
  height: '100vh',
  position: 'fixed',
  width: '100vw'
})

const LayoutRoot = styled(Box)({
  position: 'relative',
  height: '100vh'
})

const Main = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  color: theme.palette.text.primary,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: theme.typography.fontFamily,
  height: '100%',
  justifyContent: 'center',
  padding: theme.spacing(2),
  position: 'absolute',
  width: '100%'
}))

export { Background, LayoutRoot, Main }
