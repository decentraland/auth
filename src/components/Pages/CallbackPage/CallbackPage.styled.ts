import { styled, Box } from 'decentraland-ui2'
import CustomWelcomeBackground from '../../../assets/images/background/custom-welcome-background.webp'

const Container = styled(Box)({
  display: 'flex',
  height: '100vh',
  width: '100vw',
  backgroundImage: `url(${CustomWelcomeBackground})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  position: 'relative'
})

const Wrapper = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100%',
  width: '100%'
})

export { Container, Wrapper }
