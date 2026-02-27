import { Box, TextField, keyframes, styled } from 'decentraland-ui2'

const slideDown = keyframes({
  from: {
    opacity: 0,
    transform: 'translateY(-16px)'
  },
  to: {
    opacity: 1,
    transform: 'translateY(0)'
  }
})

const FloatingBar = styled(Box)(({ theme }) => ({
  animation: `${slideDown} ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeOut}`,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[4],
  left: theme.spacing(2),
  padding: theme.spacing(1.5),
  position: 'fixed',
  top: theme.spacing(2),
  zIndex: theme.zIndex.appBar
}))

const ViewSelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.spacing(40),
  ['& .MuiInputBase-root']: {
    backgroundColor: theme.palette.background.paper
  }
}))

export { FloatingBar, ViewSelect }
