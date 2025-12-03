import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { PreviewEmote } from '@dcl/schemas'
import { PreviewUnityMode } from '@dcl/schemas/dist/dapps/preview'
import { Env } from '@dcl/ui-env'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { WearablePreview } from 'decentraland-ui2'
import { config } from '../../modules/config'
import { checkWebGpuSupport } from '../../shared/utils/webgpu'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../FeatureFlagsProvider/FeatureFlagsProvider.types'
import { Props } from './CustomWearablePreview.types'
import './CustomWearablePreview.css'

export const CustomWearablePreview = (props: Props) => {
  const { flags, initialized: initializedFlags } = useContext(FeatureFlagsContext)

  const [isLoading, setIsLoading] = useState(true)
  const [hasWebGPU, setHasWebGPU] = useState(false)
  const [isCheckingWebGPU, setIsCheckingWebGPU] = useState(true)

  useEffect(() => setIsLoading(true), [props.profile])

  useEffect(() => {
    async function initializeWebGpu() {
      setIsCheckingWebGPU(true)
      const webGPUSupported = await checkWebGpuSupport()
      setHasWebGPU(webGPUSupported)
      setIsCheckingWebGPU(false)
    }

    initializeWebGpu()
  }, [])

  const isUnityWearablePreviewEnabled = flags[FeatureFlagsKeys.UNITY_WEARABLE_PREVIEW]
  const isUnityWearablePreviewAllowed = !!isUnityWearablePreviewEnabled && hasWebGPU && !isCheckingWebGPU

  const platformDefinition = useMemo(() => {
    if (isUnityWearablePreviewAllowed) {
      return ''
    }

    const getRepresentation = (bodyShape: 'BaseMale' | 'BaseFemale') => {
      const mainFile = 'platform.glb'
      const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin

      return {
        bodyShapes: [`urn:decentraland:off-chain:base-avatars:${bodyShape}`],
        mainFile,
        contents: [
          {
            key: mainFile,
            url: `${baseUrl}/misc/platform/${mainFile}`
          }
        ]
      }
    }

    return btoa(
      JSON.stringify({
        data: {
          representations: [getRepresentation('BaseMale'), getRepresentation('BaseFemale')]
        }
      })
    )
  }, [isUnityWearablePreviewAllowed])

  const handleOnLoad = useCallback(() => setIsLoading(false), [])

  if (!initializedFlags) {
    return null
  }

  return (
    <div className="CustomWearablePreview">
      <WearablePreview
        base64s={[platformDefinition]}
        baseUrl={config.get('WEARABLE_PREVIEW_URL')}
        cameraY={0.2}
        dev={config.is(Env.DEVELOPMENT)}
        disableAutoRotate
        disableBackground={true}
        emote={PreviewEmote.WAVE}
        lockBeta={true}
        panning={false}
        profile={props.profile}
        unity={isUnityWearablePreviewAllowed}
        unityMode={PreviewUnityMode.AUTH}
        onLoad={handleOnLoad}
      />

      {isLoading ? <Loader active={true} size="huge" /> : null}
    </div>
  )
}
