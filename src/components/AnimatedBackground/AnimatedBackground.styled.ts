import { styled } from 'decentraland-ui2'
import { AnimatedBackgroundVariant } from './AnimatedBackground.types'

const Canvas = styled('canvas')<{ variant: AnimatedBackgroundVariant }>(({ variant }) => ({
  top: 0,
  left: 0,
  ...(variant === 'fixed'
    ? {
        position: 'fixed' as const,
        width: '100vw',
        height: '100vh',
        zIndex: 0
      }
    : {
        position: 'absolute' as const,
        width: '100%',
        height: '100%',
        zIndex: -1
      })
}))

export { Canvas }
