import { brand } from 'decentraland-ui2/dist/theme/colors'
import { Box, Button, Typography, styled } from 'decentraland-ui2'

const Container = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: 520,
  maxWidth: '90vw',
  background: 'radial-gradient(circle at center, #7434B1, #5E288F, #481C6C, #2B1040)',
  borderRadius: 17,
  boxShadow: '0px 5.7px 14.2px rgba(0, 0, 0, 0.4)',
  padding: theme.spacing(5, 4),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(2),
  color: 'white',
  textAlign: 'center'
}))

const IconCircle = styled(Box)({
  width: 60,
  height: 60,
  borderRadius: '50%',
  backgroundColor: 'rgba(255, 255, 255, 0.12)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: 'white'
})

const Title = styled(Typography)({
  fontWeight: 700,
  fontSize: 24,
  lineHeight: 1.2,
  color: 'white'
})

const Message = styled(Typography)({
  fontWeight: 500,
  fontSize: 17,
  lineHeight: 1.5,
  color: 'rgba(255, 255, 255, 0.9)',
  maxWidth: 420
})

const GasLine = styled(Typography)(({ theme }) => ({
  fontFamily: 'monospace',
  fontSize: 14,
  color: 'rgba(255, 255, 255, 0.85)',
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  borderRadius: 10,
  padding: theme.spacing(1, 2)
}))

const Actions = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  justifyContent: 'center',
  marginTop: theme.spacing(1),
  flexWrap: 'wrap'
}))

/* eslint-disable @typescript-eslint/naming-convention -- MUI class selectors */
const CancelButton = styled(Button)({
  '&.MuiButton-root': {
    color: 'white',
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    padding: '10px 32px',
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: '0.46px',
    textTransform: 'uppercase',
    '&:hover': {
      borderColor: 'white',
      backgroundColor: 'rgba(255, 255, 255, 0.08)'
    },
    '&:focus-visible': {
      outline: '2px solid white',
      outlineOffset: 2
    }
  }
})

const ConfirmButton = styled(Button)({
  '&.MuiButton-sizeMedium.MuiButton-containedPrimary': {
    backgroundColor: brand.ruby,
    borderRadius: 12,
    padding: '10px 40px',
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: '0.46px',
    textTransform: 'uppercase',
    '&:hover': {
      backgroundColor: '#E6274D'
    },
    '&:focus-visible': {
      outline: '2px solid white',
      outlineOffset: 2
    }
  }
})
/* eslint-enable @typescript-eslint/naming-convention */

export { Actions, CancelButton, ConfirmButton, Container, GasLine, IconCircle, Message, Title }
