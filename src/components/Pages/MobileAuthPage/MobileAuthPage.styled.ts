import { Box, styled } from 'decentraland-ui2'

const Main = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100dvh',
  maxHeight: '100dvh',
  width: '100%',
  position: 'relative',
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

const Background = styled(Box)({
  width: '100%',
  height: '100%',
  top: 0,
  left: 0,
  position: 'absolute',
  zIndex: -1
})

const Content = styled(Box)({
  width: '100%',
  maxWidth: '420px',
  zIndex: 1,
  padding: '20px'
})

const MobileConnectionWrapper = styled(Box)({
  // Target MainContentContainer (2nd child of ConnectionContainer)
  ['& > div > div:nth-of-type(2)']: {
    marginTop: '24px !important'
  },
  // Target Title inside MainContentContainer
  ['& > div > div:nth-of-type(2) > p:first-of-type']: {
    marginBottom: '32px !important'
  },
  // Target ShowMoreContainer (3rd child of ConnectionContainer)
  ['& > div > div:nth-of-type(3)']: {
    marginTop: '20px !important'
  }
})

const SuccessContainer = styled(Box)({
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
  marginTop: '24px',
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

const LoadingContainer = styled(Box)({
  zIndex: 1,
  padding: '40px 20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  maxWidth: '500px'
})

const LoadingTitle = styled(Box)({
  fontSize: '36px',
  fontWeight: 600,
  lineHeight: '44px',
  marginTop: '48px',
  color: 'white'
})

const ActionButton = styled(Box)({
  marginTop: '24px',
  ['& .ui.button']: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }
})

const TestButtonGroup = styled(Box)({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginTop: '16px',
  ['& .ui.button']: {
    width: '100%'
  }
})

export {
  ActionButton,
  Background,
  Content,
  Description,
  Icon,
  LoaderWrapper,
  LoadingContainer,
  LoadingTitle,
  Logo,
  LogoLarge,
  Main,
  MobileConnectionWrapper,
  SuccessContainer,
  TestButtonGroup,
  Title
}
