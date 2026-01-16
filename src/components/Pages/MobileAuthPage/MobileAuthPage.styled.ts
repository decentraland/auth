import { Box, styled } from 'decentraland-ui2'
import logoImg from '../../../assets/images/logo.svg'
import wrongImg from '../../../assets/images/wrong.svg'

const Main = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  width: '100%',
  position: 'relative',
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
  backgroundImage: `url(${logoImg})`,
  backgroundSize: 'contain',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center'
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

export { Background, Content, Description, ErrorLogo, Logo, Main, MobileConnectionWrapper, SuccessContainer, Title }
