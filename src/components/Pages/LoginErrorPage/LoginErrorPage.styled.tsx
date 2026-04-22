import { brand } from 'decentraland-ui2/dist/theme/colors'
import { Box, Button, Logo, styled } from 'decentraland-ui2'
// eslint-disable-next-line @typescript-eslint/naming-convention
import AvatarErrorImage from '../../../assets/images/avatar_error.png'

const PageContainer = styled(Box)({
  position: 'relative',
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
})

const BackgroundShadow = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'linear-gradient(90deg, #2A0C43 20%, rgba(42,12,67,0) 100%)',
  zIndex: 1
})

const ContentWrapper = styled(Box)({
  position: 'relative',
  zIndex: 2,
  display: 'flex',
  width: '100%',
  height: '100%',
  alignItems: 'center'
})

const LeftSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'flex-start',
  padding: '0 0 0 162px',
  color: 'white',
  width: '50%',
  zIndex: 3,
  [theme.breakpoints.down('lg')]: {
    padding: '0 0 0 80px'
  },
  [theme.breakpoints.down('md')]: {
    width: '100%',
    padding: '0 48px'
  }
}))

const RightSection = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  position: 'relative',
  zIndex: 2,
  [theme.breakpoints.down('md')]: {
    display: 'none'
  }
}))

const StyledLogo = styled(Logo)({
  fontSize: '63px',
  position: 'absolute',
  top: '81.5px',
  left: '62px',
  zIndex: 3
})

const TitleRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '18px',
  marginBottom: '32px'
})

const ErrorIcon = styled(Box)({
  flexShrink: 0,
  width: 46,
  height: 46,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
})

const Title = styled('h1')({
  fontFamily: 'Inter, sans-serif',
  fontWeight: 600,
  fontSize: 48,
  lineHeight: 1.167,
  color: 'white',
  margin: 0,
  whiteSpace: 'nowrap'
})

const Description = styled('p')({
  fontFamily: 'Inter, sans-serif',
  fontWeight: 500,
  fontSize: 24,
  lineHeight: 1.334,
  color: 'white',
  margin: '0 0 32px 0',
  maxWidth: 595
})

/* eslint-disable @typescript-eslint/naming-convention */
const TryAgainButton = styled(Button)({
  '&.MuiButton-sizeMedium.MuiButton-containedPrimary': {
    backgroundColor: brand.ruby,
    borderRadius: 12,
    padding: '10px 48px',
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: '0.46px',
    textTransform: 'uppercase',
    '&:hover': {
      backgroundColor: '#E6274D'
    },
    '&:focus-visible': {
      outline: '2px solid white',
      outlineOffset: 2
    }
  }
})
/* eslint-enable @typescript-eslint/naming-convention */

const AvatarError = styled('img')({
  maxWidth: '100%',
  maxHeight: '80vh',
  objectFit: 'contain'
})

function AvatarErrorSection() {
  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <AvatarError src={AvatarErrorImage} alt="" />
    </Box>
  )
}

export {
  AvatarErrorSection,
  BackgroundShadow,
  ContentWrapper,
  Description,
  ErrorIcon,
  LeftSection,
  PageContainer,
  RightSection,
  StyledLogo,
  Title,
  TitleRow,
  TryAgainButton
}
