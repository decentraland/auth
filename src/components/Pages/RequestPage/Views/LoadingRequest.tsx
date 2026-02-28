import { CircularProgress } from 'decentraland-ui2'
import { Container } from '../Container'

export const LoadingRequest = () => {
  return (
    <Container>
      <CircularProgress size={60} />
    </Container>
  )
}
