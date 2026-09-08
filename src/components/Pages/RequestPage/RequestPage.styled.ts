/* eslint-disable @typescript-eslint/naming-convention -- CSS selectors, keyframes, and pseudo-elements use non-camelCase */
import { Alert, Box, Button, styled } from 'decentraland-ui2'

const VerificationCode = styled(Box)(({ theme }) => ({
  fontSize: '100px',
  fontWeight: 700,
  lineHeight: '121.02px',
  marginTop: theme.spacing(5)
}))

const ButtonsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: theme.spacing(3),
  marginTop: theme.spacing(5),
  zIndex: 1
}))

const baseButtonStyles = {
  border: '1px solid var(--text)',
  background: '#fff',
  color: '#000',
  boxShadow: 'none',
  display: 'flex'
} as const

const NoButton = styled(Button)({
  '&&.MuiButton-root': {
    ...baseButtonStyles,
    '&:hover': baseButtonStyles,
    '& .MuiButton-startIcon': {
      color: 'red'
    }
  }
})

const YesButton = styled(Button)({
  '&&.MuiButton-root': {
    ...baseButtonStyles,
    '&:hover': baseButtonStyles,
    '& .MuiButton-startIcon': {
      color: 'green'
    }
  }
})

const TimeoutMessage = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.875),
  borderRadius: '10px',
  marginTop: theme.spacing(3.75),
  lineBreak: 'anywhere',
  backgroundColor: '#201116bf',
  color: 'white',
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1)
}))

// Shown on every review when it replaced one invalidated by a network change (see restartTransactionReview).
const ReviewRestartedNotice = styled(Alert)(({ theme }) => ({
  marginTop: theme.spacing(2),
  textAlign: 'left',
  width: '100%'
}))

export { VerificationCode, ButtonsContainer, NoButton, YesButton, TimeoutMessage, ReviewRestartedNotice }
