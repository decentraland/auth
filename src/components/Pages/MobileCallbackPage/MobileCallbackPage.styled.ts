import { Box, styled } from 'decentraland-ui2'

// Export SVG imports for use as img src
export { default as logoImg } from '../../../assets/images/logo.svg'
export { default as wrongImg } from '../../../assets/images/wrong.svg'

const Main = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100dvh',
  maxHeight: '100dvh',
  width: '100%',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  position: 'relative',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden',
  padding: '0 20px',
  boxSizing: 'border-box',
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

const Logo = styled('img')({
  width: '40px',
  height: '40px'
})

const LogoLarge = styled('img')({
  width: '64px',
  height: '64px'
})

const Icon = styled('img')({
  width: '40px',
  height: '40px'
})

const LoaderWrapper = styled(Box)({
  position: 'relative',
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  ['& .ui.loader']: {
    position: 'relative',
    left: 'auto',
    transform: 'none'
  }
})

export { Container, Description, Icon, LoaderWrapper, LoadingContainer, LoadingText, Logo, LogoLarge, Main, Title }
