import { Box, keyframes, styled } from 'decentraland-ui2'
import { desktopLinearGradient, gradientPseudoElement, mobileLinearGradient } from '../../shared/GradientBackground.styled'

const moveBackground = keyframes({
  from: {
    transform: 'translateX(0)'
  },
  to: {
    transform: 'translateX(10%)'
  }
})

const Main = styled('main')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '40% 60%',
  height: '100%',
  width: '100%',
  maxWidth: '100vw',
  position: 'relative',
  overflow: 'hidden',
  minWidth: 0,
  boxSizing: 'border-box',
  ['&::before']: {
    ...(gradientPseudoElement as object),
    background: desktopLinearGradient
  },
  [theme.breakpoints.down('lg')]: {
    gridTemplateColumns: '50% 50%'
  },
  [theme.breakpoints.down('sm')]: {
    display: 'flex',
    height: 'auto',
    ['&::before']: {
      background: mobileLinearGradient
    }
  }
}))

const BackgroundWrapper = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  zIndex: -1,
  overflow: 'hidden'
})

const Background = styled(Box)<{ isVisible?: boolean }>(({ isVisible = true }) => ({
  width: '100%',
  height: '100%',
  position: 'absolute',
  top: 0,
  left: 0,
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
  backgroundPosition: 'right',
  animation: `${moveBackground} 10s linear infinite alternate`,
  transition: 'opacity 1s ease-in-out',
  opacity: isVisible ? 1 : 0
}))

const Left = styled(Box)(({ theme }) => ({
  width: '100%',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'start',
  padding: theme.spacing(10, 0),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2.5)
  }
}))

const LeftInfo = styled(Box)({
  height: '100%',
  width: '100%',
  maxWidth: '420px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between'
})

const MainContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(6)
}))

const NewUserInfo = styled(Box)(({ theme }) => ({
  fontSize: '16px',
  lineHeight: '150%',
  letterSpacing: '0px',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '& span': {
    color: theme.palette.primary.main,
    textDecoration: 'underline',
    textTransform: 'uppercase',
    cursor: 'pointer'
  }
}))

const GuestInfo = styled(Box)(({ theme }) => ({
  color: theme.palette.common.white,
  fontSize: '16px',
  borderTop: `1px solid ${theme.palette.common.white}`,
  paddingTop: theme.spacing(1.875),
  display: 'flex',
  gap: theme.spacing(0.625),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '& a': {
    color: theme.palette.common.white,
    textDecoration: 'underline'
  }
}))

export { Background, BackgroundWrapper, GuestInfo, Left, LeftInfo, Main, MainContainer, NewUserInfo }
