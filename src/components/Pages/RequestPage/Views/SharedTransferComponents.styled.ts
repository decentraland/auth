import { Box, styled, Typography, Alert, Profile, Button, CircularProgress, circularProgressClasses } from 'decentraland-ui2'

// ============================================
// LAYOUT COMPONENTS
// ============================================

export const CenteredContent = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  width: '100%',
  maxWidth: '600px'
})

// ============================================
// TEXT COMPONENTS
// ============================================

export const Title = styled(Typography)({
  fontSize: '36px',
  fontWeight: '600',
  fontStyle: 'normal',
  lineHeight: '100%',
  letterSpacing: '0px',
  textAlign: 'center',
  marginBottom: '10px'
})

export const ItemName = styled(Box)({
  fontSize: '22px',
  fontWeight: 600,
  marginBottom: '24px'
})

export const SecondaryText = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  marginBottom: '32px',
  fontSize: '18px',
  flexWrap: 'wrap'
})

export const Label = styled(Typography)({
  fontSize: '18px',
  fontWeight: 400,
  marginBottom: '16px',
  color: 'rgba(255, 255, 255, 0.8)'
})

// ============================================
// PROFILE COMPONENTS
// ============================================

export const RecipientProfile = styled(Box)({
  marginBottom: '32px'
})

export const RecipientProfileText = styled(Profile)({
  fontWeight: '700',
  fontSize: '24px',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '& span': {
    fontWeight: '700 !important'
  },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '& .MuiAvatar-root': {
    width: '40px',
    height: '40px'
  }
})

// ============================================
// IMAGE/ASSET COMPONENTS
// ============================================

export const AssetImageWrapper = styled(Box)({
  width: '260px',
  height: '260px',
  marginBottom: '16px',
  borderRadius: '16px',
  overflow: 'hidden',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  }
})

// ============================================
// BUTTON COMPONENTS
// ============================================

export const ButtonsContainer = styled(Box)({
  display: 'flex',
  gap: '16px',
  width: '100%',
  maxWidth: '400px'
})

export const CancelButton = styled(Button)({
  background: 'rgba(0, 0, 0, 0.40) !important',
  color: 'white !important',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '&:hover': {
    background: 'rgba(0, 0, 0, 0.60) !important',
    color: 'white !important'
  }
})

export const ConfirmButton = styled(Button)({
  borderRadius: '12px'
})

// ============================================
// LOADING COMPONENTS
// ============================================

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

// ============================================
// ALERT COMPONENTS
// ============================================

// eslint-disable-next-line @typescript-eslint/naming-convention
export const InfoAlert = styled(Alert)({
  width: '100%',
  marginTop: '18px',
  background: '#00000033',
  borderRadius: '12px',
  alignSelf: 'center',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: '18px',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '& .MuiAlert-icon': {
    color: 'white',
    marginRight: '6px',
    alignItems: 'center'
  }
})

// eslint-disable-next-line @typescript-eslint/naming-convention
export const WarningAlert = styled(Alert)({
  width: '100%',
  maxWidth: '400px',
  background: 'transparent',
  color: 'white',
  alignSelf: 'center',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '& .MuiAlert-icon': {
    color: 'white',
    marginRight: '6px',
    alignItems: 'center'
  }
})

