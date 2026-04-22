import { CircularProgress } from 'decentraland-ui2'
import { AnimatedBackground } from '../../../AnimatedBackground'

export const LoadingRequest = () => {
  return (
    <div>
      <AnimatedBackground />
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%'
        }}
      >
        <CircularProgress size={60} />
      </div>
    </div>
  )
}
