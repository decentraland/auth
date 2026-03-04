/* eslint-disable @typescript-eslint/naming-convention -- CSS selectors, keyframes, and pseudo-elements use non-camelCase */
import { Box, CircularProgress, Dialog, keyframes, styled } from 'decentraland-ui2'

/**
 * Class name applied to the OTP Dialog root.
 * MUI Dialog does not expose a way to style its internal .MuiDialog-container (the scroll wrapper
 * that sits between the backdrop and the paper). By passing this class to the Dialog and
 * targeting `.MuiDialog-container` in global styles, we can apply the dark overlay to the full
 * viewport so page content does not show through.
 */
const OTP_MODAL_ROOT_CLASS = 'otp-modal-root'

/**
 * Global styles for the OTP modal's dialog container.
 * Rendered via MUI GlobalStyles in EmailLoginModal; applies a semi-transparent dark overlay
 * to the container so the backdrop covers the whole screen consistently.
 */
const otpModalContainerGlobalStyles = {
  [`.${OTP_MODAL_ROOT_CLASS} .MuiDialog-container`]: {
    background: 'rgba(0, 0, 0, 0.6)',
    position: 'fixed',
    inset: 0
  }
}

const shake = keyframes({
  '0%, 100%': { transform: 'translateX(0)' },
  '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-6px)' },
  '20%, 40%, 60%, 80%': { transform: 'translateX(6px)' }
})

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    background: 'linear-gradient(135deg, #952dc6 0%, #32134c 100%)',
    borderRadius: '16px',
    maxWidth: '480px',
    margin: 'auto',
    [theme.breakpoints.down('md')]: {
      width: '90%',
      maxWidth: '400px',
      minWidth: 'auto',
      minHeight: 'auto',
      height: 'auto',
      margin: 'auto',
      borderRadius: '16px',
      top: 'auto',
      padding: 0
    },
    [theme.breakpoints.down('sm')]: {
      width: '90%',
      maxWidth: '360px'
    }
  },
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    position: 'fixed',
    inset: 0
  }
}))

const Header = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(2, 2.5)
}))

const BackButton = styled('button')(({ theme }) => ({
  background: 'none',
  border: 'none',
  color: 'white',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: theme.spacing(1, 1.5),
  transition: 'opacity 0.2s',
  '&:hover:not(:disabled)': { opacity: 0.8 },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' }
}))

const BackIcon = styled('span')({
  fontSize: 20,
  lineHeight: 1
})

const CloseButton = styled('button')(({ theme }) => ({
  background: 'none',
  border: 'none',
  color: 'white',
  fontSize: 28,
  cursor: 'pointer',
  padding: theme.spacing(0.5, 1.5),
  lineHeight: 1,
  transition: 'opacity 0.2s',
  '&:hover:not(:disabled)': { opacity: 0.8 },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' }
}))

const Main = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0, 5, 5),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(0, 3, 4)
  }
}))

const Content = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center'
})

const EmailIconContainer = styled(Box)(({ theme }) => ({
  width: 100,
  height: 100,
  borderRadius: '50%',
  background: 'rgba(255, 255, 255, 0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    width: 80,
    height: 80,
    marginBottom: theme.spacing(2.5)
  }
}))

const EmailIcon = styled('img')(({ theme }) => ({
  width: 48,
  height: 48,
  display: 'block',
  filter: 'brightness(0) invert(1)',
  [theme.breakpoints.down('sm')]: {
    width: 40,
    height: 40
  }
}))

const Title = styled('p')(({ theme }) => ({
  color: 'white',
  fontSize: 28,
  fontWeight: 600,
  margin: 0,
  marginBottom: theme.spacing(1.5),
  [theme.breakpoints.down('sm')]: {
    fontSize: 22
  }
}))

const Subtitle = styled('p')(({ theme }) => ({
  color: 'rgba(255, 255, 255, 0.85)',
  fontSize: 14,
  lineHeight: 1.5,
  margin: 0,
  marginBottom: theme.spacing(4),
  maxWidth: 340,
  '& strong': {
    color: 'white',
    fontWeight: 600
  },
  [theme.breakpoints.down('sm')]: {
    fontSize: 13
  }
}))

const OtpContainer = styled(Box, {
  shouldForwardProp: prop => prop !== 'hasError'
})<{ hasError?: boolean }>(({ theme, hasError }) => ({
  display: 'flex',
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(3),
  ...(hasError && {
    animation: `${shake} 0.5s ease-in-out`
  }),
  [theme.breakpoints.down('sm')]: {
    gap: theme.spacing(1)
  }
}))

const OtpInput = styled('input', {
  shouldForwardProp: prop => prop !== 'hasError'
})<{ hasError?: boolean }>(({ theme, hasError }) => ({
  width: 52,
  height: 60,
  border: `2px solid ${hasError ? '#ff4444' : 'rgba(255, 255, 255, 0.3)'}`,
  borderRadius: 12,
  background: hasError ? 'rgba(255, 68, 68, 0.1)' : 'transparent',
  color: 'white',
  fontSize: 24,
  fontWeight: 600,
  textAlign: 'center',
  outline: 'none',
  transition: 'border-color 0.2s, background-color 0.2s',
  '&:focus': {
    borderColor: 'white',
    background: 'rgba(255, 255, 255, 0.1)'
  },
  '&:disabled': {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  '&::placeholder': {
    color: 'rgba(255, 255, 255, 0.3)'
  },
  [theme.breakpoints.down('sm')]: {
    width: 42,
    height: 50,
    fontSize: 20,
    borderRadius: 10
  }
}))

const VerifyingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(2)
}))

const VerifyingLoader = styled(CircularProgress)({
  '&.MuiCircularProgress-root': {
    color: 'white'
  }
})

const VerifyingText = styled('span')({
  color: 'rgba(255, 255, 255, 0.85)',
  fontSize: 14
})

const ErrorMessage = styled('p')(({ theme }) => ({
  color: '#ff6b6b',
  fontSize: 14,
  margin: 0,
  marginBottom: theme.spacing(2),
  '&::before': {
    content: '"\\26A0"',
    marginRight: theme.spacing(0.75)
  }
}))

const ResendText = styled('p')(({ theme }) => ({
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: 14,
  margin: theme.spacing(1, 0, 0)
}))

const ResendLink = styled('span')(({ theme }) => ({
  color: theme.palette.primary.main,
  cursor: 'pointer',
  textDecoration: 'underline',
  transition: 'color 0.2s',
  '&:hover': {
    color: '#ffb3b3'
  }
}))

const ResendLinkError = styled('span')({
  color: 'white',
  fontSize: 14,
  cursor: 'pointer',
  textDecoration: 'underline',
  transition: 'opacity 0.2s',
  '&:hover': {
    opacity: 0.8
  }
})

export {
  OTP_MODAL_ROOT_CLASS,
  otpModalContainerGlobalStyles,
  StyledDialog,
  Header,
  BackButton,
  BackIcon,
  CloseButton,
  Main,
  Content,
  EmailIconContainer,
  EmailIcon,
  Title,
  Subtitle,
  OtpContainer,
  OtpInput,
  VerifyingContainer,
  VerifyingLoader,
  VerifyingText,
  ErrorMessage,
  ResendText,
  ResendLink,
  ResendLinkError
}
