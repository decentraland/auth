import { Alert, Box, Button, CircularProgress, Typography, circularProgressClasses, styled } from 'decentraland-ui2'

const ButtonsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(4),
  maxWidth: theme.spacing(100),
  width: '100%'
}))

const CancelButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.action.selected,
  color: theme.palette.text.primary,
  ['&:hover']: {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary
  },
  ['&:focus-visible']: {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2
  }
}))

const CenteredContent = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  maxWidth: theme.spacing(75),
  textAlign: 'center',
  width: 'fit-content'
}))

const ConfirmButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  ['&:focus-visible']: {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2
  }
}))

const ItemName = styled(Box)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(22),
  fontWeight: 600,
  marginTop: theme.spacing(2.5)
}))

const Label = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(18),
  fontWeight: 400,
  marginTop: theme.spacing(6.25),
  opacity: 0.8
}))

const LoadingContainer = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'row',
  gap: theme.spacing(4),
  marginTop: theme.spacing(6)
}))

const LoadingText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(18),
  fontStyle: 'normal',
  fontWeight: 400,
  letterSpacing: '0px',
  lineHeight: '100%'
}))

const ProgressContainer = styled(Box)({
  display: 'inline-flex',
  position: 'relative'
})

const ProgressSpinner = styled(CircularProgress)(({ theme }) => ({
  animationDuration: `${theme.transitions.duration.shorter}ms`,
  color: theme.palette.primary.main,
  left: 0,
  position: 'absolute',
  [`& .${circularProgressClasses.circle}`]: {
    strokeLinecap: 'round'
  }
}))

const ProgressTrack = styled(CircularProgress)(({ theme }) => ({
  color: theme.palette.action.disabled
}))

const Title = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(36),
  fontStyle: 'normal',
  fontWeight: 600,
  letterSpacing: '0px',
  lineHeight: '100%',
  marginBottom: theme.spacing(2.5),
  textAlign: 'center'
}))

const WarningAlert = styled(Alert)(({ theme }) => ({
  alignItems: 'center',
  alignSelf: 'center',
  backgroundColor: 'transparent',
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(18),
  justifyContent: 'center',
  maxWidth: theme.spacing(100),
  width: '100%',
  marginTop: theme.spacing(5),
  marginBottom: theme.spacing(-8),
  ['& .MuiAlert-icon']: {
    alignItems: 'center',
    color: theme.palette.text.primary,
    marginRight: theme.spacing(1.5)
  }
}))

export {
  ButtonsContainer,
  CancelButton,
  CenteredContent,
  ConfirmButton,
  ItemName,
  Label,
  LoadingContainer,
  LoadingText,
  ProgressContainer,
  ProgressSpinner,
  ProgressTrack,
  Title,
  WarningAlert
}
