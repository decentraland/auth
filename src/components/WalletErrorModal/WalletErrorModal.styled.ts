import { brand } from 'decentraland-ui2/dist/theme/colors'
import { Box, Button, IconButton, styled } from 'decentraland-ui2'

const Backdrop = styled(Box)({
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1300
})

const ModalContainer = styled(Box)({
  position: 'relative',
  width: 611,
  maxWidth: '90vw',
  background: 'radial-gradient(circle at center, #7434B1, #5E288F, #481C6C, #2B1040)',
  borderRadius: 17,
  boxShadow: '0px 5.7px 14.2px rgba(0, 0, 0, 0.4)',
  padding: '48px 24px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '24px'
})

/* eslint-disable @typescript-eslint/naming-convention */
const CloseButton = styled(IconButton)({
  position: 'absolute',
  top: 16,
  right: 16,
  color: 'white',
  padding: 4,
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  '&:focus-visible': {
    outline: '2px solid white',
    outlineOffset: 2
  }
})

const ErrorCircle = styled(Box)({
  width: 60,
  height: 60,
  borderRadius: '50%',
  backgroundColor: brand.ruby,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
})

const Message = styled('p')({
  fontFamily: 'Inter, sans-serif',
  fontWeight: 500,
  fontSize: 20,
  lineHeight: 1.6,
  color: 'white',
  textAlign: 'center',
  margin: 0,
  maxWidth: 500
})

const TryAgainButton = styled(Button)({
  '&.MuiButton-sizeMedium.MuiButton-containedPrimary': {
    backgroundColor: brand.ruby,
    borderRadius: 12,
    padding: '10px 48px',
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

export { Backdrop, CloseButton, ErrorCircle, Message, ModalContainer, TryAgainButton }
