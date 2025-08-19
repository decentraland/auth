import Lottie from 'lottie-react'
import { Logo, Box, styled, Typography, TextField, Checkbox, FormControlLabel, Button, Link } from 'decentraland-ui2'
import CustomWelcomeBackground from '../../../assets/images/background/custom-welcome-background.webp'

const MainContainer = styled(Box)({
  display: 'flex',
  height: '100vh',
  backgroundImage: `url(${CustomWelcomeBackground})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  fontFamily: 'Arial, sans-serif'
})

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

const LeftFormSection = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'flex-start',
  padding: '0 0 0 240px',
  color: 'white',
  width: '50%'
})

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

const InputContainer = styled(Box)({
  width: '100%',
  maxWidth: '400px',
  marginBottom: '24px'
})

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

const ContinueButton = styled(Button)({})

const RightAvatarSection = styled(Box)({
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  position: 'relative',
  width: '1000px'
})

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
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  opacity: isVisible ? 1 : 0,
  pointerEvents: isVisible ? 'auto' : 'none',
  zIndex: isVisible ? 1000 : 0,
  transition: 'opacity 0.3s ease-in-out',
  visibility: 'visible'
}))

export {
  MainContainer,
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
  EmailDescription,
  CheckboxContainer,
  CheckboxRow,
  LinkCheckbox,
  CheckboxInput,
  ContinueButton,
  RightAvatarSection,
  AvatarParticles,
  PreloadedWearableContainer
}
