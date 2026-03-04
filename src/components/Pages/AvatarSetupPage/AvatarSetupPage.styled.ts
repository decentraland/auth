import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import Lottie from 'lottie-react'
import { brand, neutral } from 'decentraland-ui2/dist/theme/colors'
import { Logo, Box, styled, Typography, TextField, Checkbox, FormControlLabel, Button, Link } from 'decentraland-ui2'
import SetupRightBackground from '../../../assets/images/setup-right-background.webp'

const MainContainer = styled(Box)({
  display: 'flex',
  height: '100vh',
  minHeight: '700px',
  fontFamily: 'Arial, sans-serif',
  position: 'relative',
  overflow: 'hidden'
})

const BackgroundShadow = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(90deg, #2A0C43 20%, rgba(42,12,67,0) 100%)',
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  [theme.breakpoints.down('sm')]: {
    background: 'linear-gradient(180deg, #2A0C43 20%, rgba(42,12,67,0) 100%)'
  }
}))

const LoadingTitle = styled(Typography)({
  marginTop: '76px',
  marginBottom: '42px',
  fontWeight: '500',
  fontStyle: 'Medium',
  fontSize: '24px',
  lineHeight: '133%',
  letterSpacing: '0px',
  textAlign: 'center',
  verticalAlign: 'middle'
})

const LoadingContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  marginLeft: 'auto',
  marginRight: 'auto'
})

const ProgressContainer = styled(Box)({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  color: 'rgb(235,68,90)'
})

const LeftFormSection = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'flex-start',
  padding: '0 0 0 240px',
  color: 'white',
  width: '50%',
  zIndex: 3,
  [theme.breakpoints.down('lg')]: {
    padding: '0 0 0 120px'
  },
  [theme.breakpoints.down('sm')]: {
    width: '100%',
    padding: '0 48px 0'
  },
  [theme.breakpoints.down('xs')]: {
    width: '100%',
    padding: '0 24px 0'
  }
}))

const DecentralandLogo = styled(Logo)({
  fontSize: '63px',
  marginBottom: '32px'
})

const WelcomeContainer = styled(Box)({
  marginBottom: '32px'
})

const WelcomeTitle = styled(Typography)({
  fontSize: '48px',
  lineHeight: '117%',
  letterSpacing: '0px'
})

const DecentralandText = styled('span')({
  fontFamily: 'DecentralandHero',
  background: 'linear-gradient(261.51deg, #FF2D55 6.92%, #FFBC5B 83.3%)',
  backgroundClip: 'text',
  webkitBackgroundClip: 'text',
  webkitTextFillColor: 'transparent',
  color: 'transparent',
  fontSize: 'inherit',
  fontWeight: 'inherit',
  lineHeight: 'inherit',
  letterSpacing: 'inherit'
})

const InputContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: '400px',
  marginBottom: '24px',
  [theme.breakpoints.down('sm')]: {
    maxWidth: '100%'
  }
}))

const InputLabel = styled(Typography)({
  fontSize: '24px',
  fontWeight: '500',
  lineHeight: '133%',
  letterSpacing: '0px',
  marginBottom: '16px'
})

const TextInput = styled(TextField)<{ hasError?: boolean }>(({ hasError }) => ({
  width: '100%',
  ['& .MuiInputBase-root']: {
    zIndex: 1,
    overflow: 'hidden',
    border: 'none'
  },
  ['& .MuiInputBase-input']: {
    backgroundColor: 'rgba(252, 252, 252, 1)',
    borderRadius: '12px',
    color: 'rgba(22, 21, 24, 1)'
  },
  ['& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline']: {
    borderColor: 'transparent'
  },
  ['& fieldset.MuiOutlinedInput-notchedOutline']: {
    display: 'none'
  },
  ['&:after']: {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    width: hasError ? 'calc(100% + 12px)' : '100%',
    height: hasError ? 'calc(100% + 12px)' : '100%',
    margin: 0,
    marginLeft: hasError ? '-6px' : '0',
    marginTop: hasError ? '-6px' : '0',
    zIndex: 0,
    borderRadius: '16px',
    overflow: 'hidden',
    border: hasError ? '3px solid rgba(224, 0, 0, 1)' : '3px solid transparent',
    transition: 'width 0.3s ease-in-out, height 0.3s ease-in-out, margin 0.3s ease-in-out, border 0.3s ease-in-out'
  }
}))

const ErrorContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '4px'
})

const ErrorText = styled('span')({
  color: 'rgba(224, 0, 0, 1)',
  fontSize: '14px'
})

const WarningIcon = styled(WarningAmberOutlinedIcon)({
  color: 'rgba(224, 0, 0, 1)',
  height: '15px',
  width: '15px'
})

const EmailDescription = styled(Typography)({
  fontSize: '14px',
  lineHeight: '100%',
  letterSpacing: '0%',
  marginTop: '8px'
})

const CheckboxContainer = styled(Box)({
  marginBottom: '30px'
})

const CheckboxRow = styled(FormControlLabel)({
  marginBottom: '12px'
})

const LinkCheckbox = styled(Link)(({ theme }) => ({
  color: 'white',
  textDecorationColor: 'white',
  ['&:hover']: {
    color: theme.palette.primary.main,
    textDecorationColor: theme.palette.primary.main,
    textDecoration: 'underline'
  }
}))

const CheckboxInput = styled(Checkbox)({
  marginRight: '12px',
  marginTop: '2px',
  accentColor: '#FF6B35'
})

const ContinueButton = styled(Button)(({ theme }) => ({
  ['&.MuiButton-sizeMedium.MuiButton-containedPrimary']: {
    padding: '24px 48px',
    fontSize: '16px',
    borderRadius: '16px'
  },
  ['&.MuiButton-sizeMedium.MuiButton-containedPrimary.Mui-disabled:not(.Mui-focusVisible):not(:hover)']: {
    backgroundColor: `${brand.ruby}50`,
    color: `${neutral.softWhite}50`
  },
  [theme.breakpoints.down('sm')]: {
    width: '100%'
  }
}))

const RightSectionBackground = styled(Box)({
  flex: 1,
  position: 'absolute',
  top: '3%',
  right: 0,
  width: '105%',
  height: '100%',
  backgroundImage: `url(${SetupRightBackground})`,
  backgroundSize: '100% auto',
  backgroundPosition: 'center right',
  backgroundRepeat: 'no-repeat'
})

const RightAvatarSection = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  position: 'relative',
  width: '1000px',
  zIndex: 2,
  [theme.breakpoints.down('sm')]: {
    display: 'none'
  }
}))

const AvatarParticles = styled(Lottie, {
  shouldForwardProp: prop => prop !== 'show'
})<{ show: boolean }>(({ show }) => ({
  width: '100%',
  height: '100%',
  display: show ? 'block' : 'none'
}))

const PreloadedWearableContainer = styled(Box, {
  shouldForwardProp: prop => prop !== 'isVisible'
})<{ isVisible: boolean }>(({ isVisible }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  overflow: 'hidden',
  opacity: isVisible ? 1 : 0,
  pointerEvents: isVisible ? 'auto' : 'none',
  zIndex: isVisible ? 1000 : 0,
  transition: 'opacity 0.3s ease-in-out',
  visibility: 'visible'
}))

export {
  MainContainer,
  BackgroundShadow,
  LoadingTitle,
  LoadingContainer,
  ProgressContainer,
  LeftFormSection,
  DecentralandLogo,
  WelcomeContainer,
  WelcomeTitle,
  DecentralandText,
  InputContainer,
  InputLabel,
  TextInput,
  ErrorContainer,
  ErrorText,
  WarningIcon,
  EmailDescription,
  CheckboxContainer,
  CheckboxRow,
  LinkCheckbox,
  CheckboxInput,
  ContinueButton,
  RightSectionBackground,
  RightAvatarSection,
  AvatarParticles,
  PreloadedWearableContainer
}
