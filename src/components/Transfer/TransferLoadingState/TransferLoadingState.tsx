import { TransferCircularProgressWithTrack } from '../TransferCircularProgressWithTrack'
import { TransferLoadingStateProps } from './TransferLoadingState.types'
import { LoadingContainer, LoadingText } from './TransferLoadingState.styled'

const TransferLoadingState = ({ text = 'Processing Authorization' }: TransferLoadingStateProps) => {
  return (
    <LoadingContainer>
      <TransferCircularProgressWithTrack />
      <LoadingText variant="body1">{text}</LoadingText>
    </LoadingContainer>
  )
}

export { TransferLoadingState }
