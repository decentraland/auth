// eslint-disable-next-line @typescript-eslint/naming-convention
import Lottie from 'lottie-react'
import { Box, styled } from 'decentraland-ui2'

const CenteredContainer = styled(Box)({
  position: 'relative',
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 78
})

const SuccessAnimation = styled(Lottie)({
  flexShrink: 0,
  zIndex: 1,
  pointerEvents: 'none'
})

const Description = styled('p')({
  fontFamily: 'Inter, sans-serif',
  fontWeight: 500,
  fontSize: 24,
  lineHeight: 1.334,
  color: 'white',
  margin: 0,
  textAlign: 'center',
  maxWidth: 595,
  zIndex: 1
})

export { CenteredContainer, Description, SuccessAnimation }
