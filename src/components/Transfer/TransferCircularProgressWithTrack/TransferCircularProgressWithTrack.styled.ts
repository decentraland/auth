import { Box, CircularProgress, circularProgressClasses, styled } from 'decentraland-ui2'

const ProgressContainer = styled(Box)({
  display: 'inline-flex',
  position: 'relative'
})

const ProgressSpinner = styled(CircularProgress)(({ theme }) => ({
  animationDuration: `${theme.transitions.duration.shorter}ms`,
  color: theme.palette.primary.main,
  left: 0,
  position: 'absolute',
  [`& .${circularProgressClasses.circle}`]: {
    strokeLinecap: 'round'
  }
}))

const ProgressTrack = styled(CircularProgress)(({ theme }) => ({
  color: theme.palette.action.disabled
}))

export { ProgressContainer, ProgressSpinner, ProgressTrack }
