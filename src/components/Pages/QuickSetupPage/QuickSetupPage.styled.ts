// eslint-disable-next-line @typescript-eslint/naming-convention
import Lottie from 'lottie-react'
import { brand, neutral } from 'decentraland-ui2/dist/theme/colors'
import { Box, Button, Checkbox, FormControlLabel, Link, Logo, TextField, Typography, styled } from 'decentraland-ui2'

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
  alignItems: 'center',
  justifyContent: 'space-between',
  maxWidth: '1492px',
  margin: '0 auto',
  padding: '0 40px'
})

const LeftSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'flex-start',
  color: 'white',
  width: '50%',
  maxWidth: '616px',
  zIndex: 3,
  [theme.breakpoints.down('md')]: {
    width: '100%',
    maxWidth: '100%',
    padding: '0 24px'
  }
}))

const RightSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '653px',
  zIndex: 2,
  [theme.breakpoints.down('md')]: {
    display: 'none'
  }
}))

const StyledLogo = styled(Logo)({
  fontSize: '63px',
  marginBottom: '32px'
})

const WelcomeTitle = styled(Typography)({
  fontFamily: 'Inter, sans-serif',
  fontWeight: 600,
  fontSize: '48px',
  lineHeight: 1.167,
  color: 'white',
  marginBottom: '32px'
})

/* eslint-disable @typescript-eslint/naming-convention */
const GradientText = styled('span')({
  background: 'linear-gradient(261.51deg, #FF2D55 6.92%, #FFBC5B 83.3%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: 'transparent',
  fontSize: 'inherit',
  fontWeight: 'inherit',
  lineHeight: 'inherit'
})
/* eslint-enable @typescript-eslint/naming-convention */

const InputLabel = styled(Typography)({
  fontFamily: 'Inter, sans-serif',
  fontWeight: 500,
  fontSize: '24px',
  lineHeight: 1.334,
  color: 'white',
  marginBottom: '16px'
})

const UsernameInput = styled(TextField)({
  width: '100%',
  maxWidth: '460px',
  ['& .MuiInputBase-root']: {
    overflow: 'hidden',
    border: 'none'
  },
  ['& .MuiInputBase-input']: {
    backgroundColor: '#fcfcfc',
    borderRadius: '12px',
    color: '#161518',
    padding: '13.5px 16px',
    fontSize: '16px'
  },
  ['& fieldset.MuiOutlinedInput-notchedOutline']: {
    display: 'none'
  },
  ['&:after']: {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
    borderRadius: '14px',
    border: '3px solid transparent',
    pointerEvents: 'none'
  }
})

const CharCount = styled(Typography)({
  fontFamily: 'Inter, sans-serif',
  fontWeight: 400,
  fontSize: '14px',
  color: 'rgba(255,255,255,0.7)',
  marginTop: '8px',
  marginBottom: '24px'
})

const EmailHelperText = styled(Typography)({
  fontFamily: 'Inter, sans-serif',
  fontWeight: 400,
  fontSize: '14px',
  color: 'rgba(255,255,255,0.7)',
  marginTop: '8px',
  marginBottom: '24px',
  maxWidth: '460px'
})

const CheckboxRow = styled(FormControlLabel)({
  marginBottom: '12px',
  alignItems: 'center',
  ['& .MuiFormControlLabel-label']: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: '16px',
    lineHeight: 1.5,
    color: 'white'
  }
})

const CheckboxInput = styled(Checkbox)({
  color: 'white',
  ['&.Mui-checked']: {
    color: 'white'
  }
})

const LinkText = styled(Link)({
  color: 'white',
  textDecorationColor: 'white',
  ['&:hover']: {
    color: '#FF2D55',
    textDecorationColor: '#FF2D55'
  }
})

const SubmitButton = styled(Button)({
  ['&.MuiButton-sizeMedium.MuiButton-containedPrimary']: {
    backgroundColor: brand.ruby,
    borderRadius: '16px',
    padding: '16px 80px',
    height: '56px',
    fontSize: '15px',
    fontWeight: 600,
    letterSpacing: '0.46px',
    textTransform: 'uppercase',
    marginTop: '16px',
    ['&:hover']: {
      backgroundColor: '#E6274D'
    }
  },
  ['&.MuiButton-sizeMedium.MuiButton-containedPrimary.Mui-disabled:not(.Mui-focusVisible):not(:hover)']: {
    backgroundColor: `${brand.ruby}80`,
    color: `${neutral.softWhite}80`
  }
})

const AvatarWrapper = styled(Box)({
  width: '582px',
  height: '719px',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  ['& .CustomWearablePreview .MuiCircularProgress-root']: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  }
})

const RandomizeBar = styled(Box)({
  display: 'flex',
  gap: '16px',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: '21px'
})

const RandomizeButton = styled(Button)({
  ['&.MuiButton-sizeMedium']: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '6px 16px',
    height: '46px',
    color: 'white',
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
    display: 'flex',
    gap: '10px',
    transition: 'background-color 0.2s, color 0.2s',
    ['&:hover']: {
      backgroundColor: '#fcfcfc',
      color: '#161518'
    }
  }
})

const BodyTypeButton = styled(Button)({
  ['&.MuiButton-sizeMedium']: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '6px 12px',
    height: '46px',
    color: 'white',
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    transition: 'background-color 0.2s, color 0.2s',
    ['&:hover']: {
      backgroundColor: '#fcfcfc',
      color: '#161518'
    }
  }
})

const BodyTypeDropdown = styled(Box)({
  position: 'absolute',
  bottom: '54px',
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: '#fcfcfc',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  padding: '4px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  width: '210px',
  zIndex: 10
})

const BodyTypeDropdownItem = styled(Box, {
  shouldForwardProp: prop => prop !== 'selected'
})<{ selected?: boolean }>(({ selected }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '8px 12px',
  height: '46px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
  fontWeight: 600,
  fontSize: '14px',
  textTransform: 'uppercase' as const,
  color: '#161518',
  backgroundColor: selected ? '#f0f0f0' : 'transparent',
  ['&:hover']: {
    backgroundColor: '#f0f0f0'
  }
}))

const BodyTypeChevron = styled(Box, {
  shouldForwardProp: prop => prop !== 'open'
})<{ open?: boolean }>(({ open }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'transform 0.2s',
  transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
  marginLeft: '4px'
}))

const RandomizeIcon = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '22px',
  height: '24px'
})

const SubText = styled(Typography)({
  fontFamily: 'Inter, sans-serif',
  fontWeight: 400,
  fontSize: '14px',
  color: 'white',
  textAlign: 'center',
  marginTop: '10px',
  width: '100%'
})

const CelebrationOverlay = styled(Box)({
  position: 'relative',
  zIndex: 2,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%'
})

const CelebrationBackground = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'radial-gradient(ellipse at center, #782499 0%, #32134C 70%)',
  zIndex: 1
})

const CelebrationTitle = styled(Typography)({
  fontFamily: 'Inter, sans-serif',
  fontWeight: 600,
  fontSize: '48px',
  lineHeight: 1.167,
  color: 'white',
  textAlign: 'center',
  zIndex: 2
})

const CelebrationAvatarWrapper = styled(Box)({
  width: '467px',
  height: '539px',
  position: 'relative',
  zIndex: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  ['& iframe']: {
    border: 'none',
    width: '100%',
    height: '100%'
  },
  ['& .MuiCircularProgress-root']: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  }
})

const CelebrateAnimation = styled(Lottie)({
  width: 720,
  height: 720,
  flexShrink: 0,
  zIndex: 2,
  pointerEvents: 'none'
})

const SuccessButton = styled(Button)({
  ['&.MuiButton-sizeMedium.MuiButton-containedPrimary']: {
    backgroundColor: brand.ruby,
    borderRadius: '16px',
    padding: '16px 48px',
    height: '56px',
    fontSize: '15px',
    fontWeight: 600,
    letterSpacing: '0.46px',
    textTransform: 'uppercase',
    marginTop: '24px',
    zIndex: 2,
    display: 'flex',
    gap: '8px',
    ['&:hover']: {
      backgroundColor: '#E6274D'
    }
  }
})

export {
  PageContainer,
  BackgroundShadow,
  ContentWrapper,
  LeftSection,
  RightSection,
  StyledLogo,
  WelcomeTitle,
  GradientText,
  InputLabel,
  UsernameInput,
  CharCount,
  EmailHelperText,
  CheckboxRow,
  CheckboxInput,
  LinkText,
  SubmitButton,
  AvatarWrapper,
  RandomizeBar,
  RandomizeButton,
  BodyTypeButton,
  BodyTypeDropdown,
  BodyTypeDropdownItem,
  BodyTypeChevron,
  RandomizeIcon,
  SubText,
  CelebrationOverlay,
  CelebrationBackground,
  CelebrationTitle,
  CelebrationAvatarWrapper,
  CelebrateAnimation,
  SuccessButton
}
