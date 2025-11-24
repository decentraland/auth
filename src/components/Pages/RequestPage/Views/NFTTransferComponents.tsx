import { Box, styled, Typography, Alert, Profile } from 'decentraland-ui2'

export const CenteredContent = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  width: '100%',
  maxWidth: '500px'
})

export const Title = styled(Typography)({
  fontSize: '36px',
  fontWeight: '600',
  fontStyle: 'normal',
  lineHeight: '100%',
  letterSpacing: '0px',
  textAlign: 'center',
  marginBottom: '10px'
})

export const RecipientProfile = styled(Box)({
  marginBottom: '32px'
})

export const RecipientProfileText = styled(Profile)({
  fontWeight: '700',
  fontSize: '22px',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '& span': {
    fontWeight: '700 !important'
  }
})

export const NFTImageWrapper = styled(Box)({
  width: '260px',
  height: '260px',
  marginBottom: '16px',
  borderRadius: '16px',
  overflow: 'hidden'
})

export const NFTName = styled(Box)({
  fontSize: '22px',
  fontWeight: 600,
  marginBottom: '24px'
})

// eslint-disable-next-line @typescript-eslint/naming-convention
export const InfoAlert = styled(Alert)({
  width: '100%',
  maxWidth: '600px',
  marginTop: '18px',
  background: '#00000033',
  alignSelf: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: '18px',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '& .MuiAlert-icon': {
    color: 'white',
    marginRight: '6px'
  }
})

// eslint-disable-next-line @typescript-eslint/naming-convention
export const WarningAlert = styled(Alert)({
  width: '100%',
  maxWidth: '400px',
  background: 'transparent',
  color: 'white',
  alignSelf: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '& .MuiAlert-icon': {
    color: 'white',
    marginRight: '6px'
  }
})
