import { useParams } from 'react-router-dom'
import { RequestPage } from './RequestPage'

/**
 * Mounts a fresh RequestPage per request id. A route parameter change would otherwise re-render the
 * same instance, which for one frame would still hold the previous request's state. Keying by the id
 * makes that impossible by construction, independently of what the page does about it itself.
 */
export const RequestPageRoute = () => {
  const { requestId } = useParams()
  return <RequestPage key={requestId ?? ''} />
}
