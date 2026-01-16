import Lottie from 'lottie-react'
import { styled } from 'decentraland-ui2'

const SuccessAnimation = styled(Lottie)({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '400px',
  height: '400px',
  pointerEvents: 'none',
  zIndex: 10
})

export { SuccessAnimation }
