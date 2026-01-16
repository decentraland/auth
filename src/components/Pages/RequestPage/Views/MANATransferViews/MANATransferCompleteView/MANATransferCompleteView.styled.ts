import Lottie from 'lottie-react'
import { styled, Typography } from 'decentraland-ui2'

export const Title = styled(Typography)({
  fontSize: '36px',
  fontWeight: '600',
  fontStyle: 'normal',
  lineHeight: '100%',
  letterSpacing: '0px',
  textAlign: 'center',
  marginBottom: '10px',
  whiteSpace: 'nowrap'
})

export const SceneImageWrapper = styled('div')({
  width: '470px',
  height: '328px',
  marginBottom: '16px',
  overflow: 'visible',
  position: 'relative'
})

export const SuccessAnimation = styled(Lottie)({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '400px',
  height: '400px',
  pointerEvents: 'none',
  zIndex: 10
})
