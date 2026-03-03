import { Box, keyframes, styled } from 'decentraland-ui2'

const moveBackground = keyframes({
  from: {
    transform: 'translateX(0)'
  },
  to: {
    transform: 'translateX(10%)'
  }
})

const Main = styled('main')<{ isNewUser?: boolean }>(({ theme, isNewUser }) => ({
  display: 'grid',
  gridTemplateColumns: '40% 60%',
  height: '100%',
  width: '100%',
  maxWidth: '100vw',
  position: 'relative',
  overflow: 'hidden',
  minWidth: 0,
  boxSizing: 'border-box',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '&::before': {
    content: '""',
    position: 'fixed',
    width: '100%',
    height: '350%',
    background: isNewUser
      ? 'linear-gradient(89.65deg, rgba(149, 45, 198, 0) 29.59%, rgba(94, 30, 130, 0.559754) 39.08%, rgba(75, 25, 106, 0.750004) 45.36%, rgba(64, 23, 93, 0.859976) 54.22%, #32134C 72.84%)'
      : 'radial-gradient(ellipse at 0 50%, transparent 10%, #e02dd3 40%, #491975 70%)',
    top: '-100%',
    transform: 'rotate(180deg)',
    overflow: 'hidden'
  },
  [theme.breakpoints.down('lg')]: {
    gridTemplateColumns: '50% 50%'
  },
  [theme.breakpoints.down('sm')]: {
    display: 'flex',
    height: 'auto',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '&::before': {
      background: isNewUser
        ? 'linear-gradient(144.23deg, #491975 10.31%, #D72CCD 102.43%)'
        : 'radial-gradient(ellipse at 0 50%, #e02dd3 0%, #491975 70%)'
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
