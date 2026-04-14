import { Box, styled } from 'decentraland-ui2'

const Main = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100dvh',
  width: '100%',
  position: 'relative',
  overflowX: 'hidden',
  padding: '40px 20px',
  boxSizing: 'border-box',
  ['&::before']: {
    content: '""',
    position: 'fixed',
    inset: 0,
    background: 'radial-gradient(71.22% 102.85% at 50.08% 77.11%, #7434B1 0%, #481C6C 37.11%, #2B1040 100%)',
    zIndex: -1
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
  // Target Title inside MainContentContainer — shrink so the long copy
  // ("Log in or Sign up to Jump In") fits on a single line on narrow phones.
  ['& > div > div:nth-of-type(2) > p:first-of-type']: {
    marginBottom: '32px !important',
    fontSize: 'clamp(20px, 5.8vw, 24px) !important',
    lineHeight: '1.3 !important'
  },
  // Target ShowMoreContainer (3rd child of ConnectionContainer)
  ['& > div > div:nth-of-type(3)']: {
    marginTop: '20px !important'
  }
})

const SuccessContainer = styled(Box)({
  zIndex: 1,
  padding: '40px 0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  width: '100%',
  maxWidth: '500px'
})

const Title = styled(Box)({
  fontSize: '28px',
  fontWeight: 600,
  lineHeight: '36px',
  marginTop: '32px',
  color: 'white'
})

const Description = styled(Box)({
  fontSize: '18px',
  fontWeight: 400,
  lineHeight: '24px',
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
  width: '100%'
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
  marginTop: '24px'
})

const TestButtonGroup = styled(Box)({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginTop: '16px'
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
