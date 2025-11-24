import { Box, Button, styled, Typography, CircularProgress, circularProgressClasses } from 'decentraland-ui2'

export const ButtonsContainer = styled(Box)({
  display: 'flex',
  gap: '16px',
  width: '100%',
  maxWidth: '400px'
})

export const CancelButton = styled(Button)({
  borderRadius: '12px',
  background: 'rgba(0, 0, 0, 0.40)',
  color: 'white',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '&:hover': {
    background: 'rgba(0, 0, 0, 0.60)',
    color: 'white !important'
  }
})

export const ConfirmButton = styled(Button)({
  borderRadius: '12px'
})

export const LoadingContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: '16px',
  marginTop: '24px'
})

export const LoadingText = styled(Typography)({
  fontSize: '18px',
  fontWeight: 400,
  fontStyle: 'normal',
  lineHeight: '100%',
  letterSpacing: '0px',
  color: 'white'
})

export const ProgressContainer = styled(Box)({
  position: 'relative',
  display: 'inline-flex'
})

export const ProgressTrack = styled(CircularProgress)({
  color: '#e0e0e0'
})

export const ProgressSpinner = styled(CircularProgress)({
  color: '#ff2d55',
  animationDuration: '550ms',
  position: 'absolute',
  left: 0,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  [`& .${circularProgressClasses.circle}`]: {
    strokeLinecap: 'round'
  }
})
