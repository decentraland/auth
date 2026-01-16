import Lottie from 'lottie-react'
import { Box, styled } from 'decentraland-ui2'

const SceneImageWrapper = styled(Box, { shouldForwardProp: prop => prop !== 'isGift' })<{ isGift?: boolean }>(({ isGift, theme }) => ({
  width: '470px',
  height: '328px',
  position: 'relative',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-end',
  marginTop: isGift ? theme.spacing(10) : theme.spacing(2.5)
}))

const SuccessAnimation = styled(Lottie)(({ theme }) => ({
  width: '400px',
  height: '400px',
  left: '50%',
  pointerEvents: 'none',
  position: 'absolute',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: theme.zIndex.modal
}))

export { SceneImageWrapper, SuccessAnimation }
