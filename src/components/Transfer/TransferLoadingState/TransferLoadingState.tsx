import { TransferCircularProgressWithTrack } from '../TransferCircularProgressWithTrack'
import { LoadingContainer, LoadingText } from './TransferLoadingState.styled'
import { TransferLoadingStateProps } from './TransferLoadingState.types'

const TransferLoadingState = ({ text = 'Processing Authorization' }: TransferLoadingStateProps) => {
  return (
    <LoadingContainer>
      <TransferCircularProgressWithTrack />
      <LoadingText variant="body1">{text}</LoadingText>
    </LoadingContainer>
  )
}

export { TransferLoadingState }
