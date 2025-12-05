import Lottie from 'lottie-react'
import { styled } from 'decentraland-ui2'

export const SceneImageWrapper = styled('div')({
  width: '260px',
  height: '260px',
  marginBottom: '16px',
  overflow: 'visible',
  position: 'relative'
})

export const SceneImageContainer = styled('div')({
  width: '100%',
  height: '100%',
  borderRadius: '16px',
  overflow: 'hidden',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  }
})

// eslint-disable-next-line @typescript-eslint/naming-convention
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

