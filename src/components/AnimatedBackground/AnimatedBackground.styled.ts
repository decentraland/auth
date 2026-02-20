import { styled } from 'decentraland-ui2'
import fallbackBackgroundUrl from '../../assets/images/background/custom-welcome-background.webp'
import { AnimatedBackgroundVariant } from './AnimatedBackground.types'

const baseVariantStyles = (variant: AnimatedBackgroundVariant) =>
  variant === 'fixed'
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
      }

const Wrapper = styled('div')<{ variant: AnimatedBackgroundVariant }>(({ variant }) => ({
  top: 0,
  left: 0,
  ...baseVariantStyles(variant)
}))

const Fallback = styled('div')<{ variant: AnimatedBackgroundVariant }>(() => ({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundImage: `url(${fallbackBackgroundUrl})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  zIndex: 0
}))

const Canvas = styled('canvas')({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  zIndex: 1
})

export { Canvas, Fallback, Wrapper }
