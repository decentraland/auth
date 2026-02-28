import { Box, Button, styled } from 'decentraland-ui2'

const VerificationCode = styled(Box)({
  fontSize: '100px',
  fontWeight: 700,
  lineHeight: '121.02px',
  marginTop: '40px'
})

const ButtonsContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '24px',
  marginTop: '40px',
  zIndex: 1
})

const baseButtonStyles = {
  border: '1px solid var(--text)',
  background: '#fff !important',
  color: '#000 !important',
  boxShadow: 'none !important',
  display: 'flex'
} as const

const NoButton = styled(Button)({
  '&.MuiButton-root': {
    ...baseButtonStyles,
    '&:hover': baseButtonStyles,
    '& .MuiButton-startIcon': {
      color: 'red'
    }
  }
})

const YesButton = styled(Button)({
  '&.MuiButton-root': {
    ...baseButtonStyles,
    '&:hover': baseButtonStyles,
    '& .MuiButton-startIcon': {
      color: 'green'
    }
  }
})

const TimeoutMessage = styled(Box)({
  padding: '15px',
  borderRadius: '10px',
  marginTop: '30px',
  lineBreak: 'anywhere',
  backgroundColor: '#201116bf',
  color: 'white',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '8px'
})

export { VerificationCode, ButtonsContainer, NoButton, YesButton, TimeoutMessage }
