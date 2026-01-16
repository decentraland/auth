import { Box, styled } from 'decentraland-ui2'
import logoImg from '../../../assets/images/logo.svg'
import wrongImg from '../../../assets/images/wrong.svg'

const Main = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  width: '100%',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  position: 'relative',
  justifyContent: 'center',
  alignItems: 'center',
  ['&::before']: {
    content: '""',
    position: 'fixed',
    width: '100%',
    height: '350%',
    background: 'radial-gradient(ellipse at 0 50%, transparent 10%, #e02dd3 40%, #491975 70%)',
    top: '-100%',
    transform: 'rotate(180deg)',
    overflow: 'hidden',
    zIndex: -1
  },
  ['@media screen and (max-width: 800px)']: {
    ['&::before']: {
      background: 'radial-gradient(ellipse at 0 50%, #e02dd3 0%, #491975 70%)'
    }
  }
})

const LoadingContainer = styled(Box)({
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '20px'
})

const LoadingLogo = styled(Box)({
  width: '64px',
  height: '64px',
  backgroundImage: `url(${logoImg})`,
  backgroundSize: 'contain',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center'
})

const LoadingText = styled(Box)({
  fontSize: '24px',
  fontWeight: 500,
  lineHeight: '32px',
  marginTop: '48px',
  marginBottom: '32px',
  color: 'white',
  maxWidth: '300px'
})

const Container = styled(Box)({
  zIndex: 1,
  padding: '40px 20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  maxWidth: '500px'
})

const ErrorLogo = styled(Box)({
  width: '40px',
  height: '40px',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
  backgroundPosition: 'right',
  backgroundImage: `url(${wrongImg})`
})

const Logo = styled(Box)({
  width: '40px',
  height: '40px',
  backgroundImage: `url(${logoImg})`
})

const Title = styled(Box)({
  fontSize: '36px',
  fontWeight: 600,
  lineHeight: '44px',
  marginTop: '32px',
  color: 'white'
})

const Description = styled(Box)({
  fontSize: '24px',
  fontWeight: 400,
  lineHeight: '29.05px',
  marginTop: '16px',
  color: 'white'
})

export { Container, Description, ErrorLogo, LoadingContainer, LoadingLogo, LoadingText, Logo, Main, Title }
