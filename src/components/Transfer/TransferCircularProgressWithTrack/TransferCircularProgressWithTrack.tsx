import { ProgressContainer, ProgressSpinner, ProgressTrack } from './TransferCircularProgressWithTrack.styled'
import { TransferCircularProgressWithTrackProps } from './TransferCircularProgressWithTrack.types'

const TransferCircularProgressWithTrack = (_props: TransferCircularProgressWithTrackProps) => {
  return (
    <ProgressContainer>
      <ProgressTrack variant="determinate" value={100} size={30} thickness={4} />
      <ProgressSpinner variant="indeterminate" disableShrink size={30} thickness={4} />
    </ProgressContainer>
  )
}

export { TransferCircularProgressWithTrack }
