import React, { useCallback, useState, useMemo, useEffect, useContext, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import CircularProgress from '@mui/material/CircularProgress'
import { BrowserProvider } from 'ethers'
import { EthAddress, Email } from '@dcl/schemas'
import type { Provider } from 'decentraland-connect'
import { WearablePreview, PreviewUnityMode, launchDesktopApp } from 'decentraland-ui2'
import avatarFloat from '../../../assets/animations/AvatarFloat_Lottie.json'
import avatarParticles from '../../../assets/animations/AvatarParticles_Lottie.json'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useTrackReferral } from '../../../hooks/useTrackReferral'
import { ClickEvents } from '../../../modules/analytics/types'
import { fetchProfile } from '../../../modules/profile'
import { createAuthServerHttpClient, createAuthServerWsClient, ExpiredRequestError, RecoverResponse } from '../../../shared/auth'
import { useCurrentConnectionData } from '../../../shared/connection/hooks'
import { locations } from '../../../shared/locations'
import { isProfileComplete } from '../../../shared/profile'
import { handleError } from '../../../shared/utils/errorHandler'
import { CharacterCounterComponent } from '../../CharacterCounter'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { subscribeToNewsletter } from '../SetupPage/utils'
import {
  MainContainer,
  LeftFormSection,
  DecentralandLogo,
  WelcomeContainer,
  WelcomeTitle,
  InputContainer,
  InputLabel,
  TextInput,
  CheckboxContainer,
  CheckboxRow,
  CheckboxInput,
  ContinueButton,
  RightAvatarSection,
  RightSectionBackground,
  PreloadedWearableContainer,
  DecentralandText,
  AvatarParticles,
  EmailDescription,
  LoadingContainer,
  ProgressContainer,
  LoadingTitle,
  LinkCheckbox,
  BackgroundShadow
} from './AvatarSetupPage.styled'
import { deployProfileFromAvatarShape } from './utils'
import { AvatarSetupState, AvatarShape } from './AvatarSetupPage.types'

const MAX_CHARACTERS = 15

const AvatarSetupPage: React.FC = () => {
  const hasTrackedReferral = useRef(false)
  const [urlSearchParams] = useSearchParams()
  const { flags, initialized: initializedFlags } = useContext(FeatureFlagsContext)
  const [initialized, setInitialized] = useState(false)
  const { url: redirectTo, redirect } = useAfterLoginRedirection()
  const { isLoading: isConnecting, account, identity, provider } = useCurrentConnectionData()
  const authServerClient = useRef(createAuthServerWsClient())
  const navigate = useNavigateWithSearchParams()
  const referrer = urlSearchParams.get('referrer')
  const { track: trackReferral } = useTrackReferral()
  const { trackClick, trackTermsOfServiceSuccess } = useAnalytics()

  const [state, setState] = useState<AvatarSetupState>({
    username: '',
    email: '',
    hasEmailError: false,
    showWearablePreview: false,
    isTermsChecked: false,
    isEmailInherited: false
  })

  const [deploying, setDeploying] = useState(false)

  const [deployError, setDeployError] = useState<string | null>(null)

  const [showErrors, setShowErrors] = useState(false)

  const [isProcessingMessage, setIsProcessingMessage] = useState(false)

  const [isAvatarParticlesAnimationEnded, setIsAvatarParticlesAnimationEnded] = useState(false)

  const requestId = useMemo(() => {
    const redirectTo = urlSearchParams.get('redirectTo')
    let requestId: string | null = null
    try {
      const url = new URL(redirectTo ?? '', window.location.origin)
      const regex = /^\/?auth\/requests\/([a-zA-Z0-9-]+)$/
      requestId = url.pathname.match(regex)?.[1] ?? null
    } catch (_e) {
      // Do nothing
    }
    return requestId
  }, [urlSearchParams])

  const characterCount = useMemo(() => state.username.length, [state.username])

  const hasError = useMemo(() => characterCount > MAX_CHARACTERS, [characterCount])

  const nameError = useMemo(() => {
    if (!state.username.length) {
      return 'Please enter your username.'
    }
    if (state.username.length >= 15) {
      return 'Sorry, usernames can have a maximum of 15 characters.'
    }
    if (state.username.includes(' ')) {
      return 'Sorry, spaces are not permitted.'
    }
    if (!/^[a-zA-Z0-9]+$/.test(state.username)) {
      return 'Sorry, special characters (!@#$%) are not permitted.'
    }
    return ''
  }, [state.username])

  const emailError = useMemo(() => {
    if (state.email && !state.email.includes('@')) {
      return 'Invalid email, please try again.'
    }
    return ''
  }, [state.email])

  const agreeError = useMemo(() => {
    if (!state.isTermsChecked) {
      return 'Please accept the terms of use and privacy policy.'
    }
    return ''
  }, [state.isTermsChecked])

  const handleContinueClick = useCallback(() => {
    const validEmail = Email.validate(state.email)
    if (state.email && state.email !== '' && !validEmail) {
      setState(prev => ({ ...prev, hasEmailError: true }))
      return
    }
    setState(prev => ({ ...prev, hasEmailError: false, showWearablePreview: true }))
    const wearablePreviewController = WearablePreview.createController('avatar-preview-configurator')
    wearablePreviewController.scene.setUsername(state.username)
  }, [state.username, state.email])

  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setState(prev => ({ ...prev, username: value }))
  }, [])

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setState(prev => ({ ...prev, email: value, hasEmailError: false }))
  }, [])

  const signRequest = useCallback(
    async (provider: Provider, requestId: string, account: string) => {
      let request: RecoverResponse | null = null
      try {
        request = await authServerClient.current.recover(requestId, account)

        if (request.method !== 'dcl_personal_sign') {
          redirect()
        }
      } catch (e) {
        if (e instanceof ExpiredRequestError) {
          console.error('Request expired')
        } else {
          handleError(e, 'Error recovering request')
        }
        return
      }

      let signature: string | null = null
      try {
        const browserProvider = new BrowserProvider(provider)
        const signer = await browserProvider.getSigner()
        signature = await signer.signMessage(request.params?.[0])

        await authServerClient.current.sendSuccessfulOutcome(requestId, account, signature)
        redirect()
      } catch (e) {
        if (e instanceof ExpiredRequestError) {
          console.error('Request expired during signing')
        } else {
          handleError(e, 'Error signing request')
        }
      }
    },
    [redirect]
  )

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (event.data.type !== 'controller_response' || event.data.payload.id !== 'customization-done') return

      // Prevent multiple simultaneous executions
      if (isProcessingMessage) {
        console.log('Message already being processed, skipping...')
        return
      }

      const avatarShape = event.data.payload.result as AvatarShape

      trackClick(ClickEvents.SUBMIT_PROFILE)
      setShowErrors(true)

      // If any of the fields has an error, don't submit
      if (nameError || emailError || agreeError) {
        return
      }

      // These refs should have values at this point
      if (!account || !identity) {
        console.warn('No account or identity found.')
        return
      }

      try {
        setIsProcessingMessage(true)
        setDeploying(true)
        setDeployError(null)

        // Deploy a new profile for the user based on the custom avatar shape
        await deployProfileFromAvatarShape({
          connectedAccount: account,
          connectedAccountIdentity: identity,
          avatarShape: avatarShape,
          deploymentProfileName: state.username
        })

        if (referrer && EthAddress.validate(referrer)) {
          try {
            await trackReferral(referrer, 'PATCH')
          } catch (error) {
            // Error is already handled in trackReferral
          }
        }

        // Subscribe to the newsletter only if the user has provided an email
        if (state.email) {
          try {
            await subscribeToNewsletter(state.email)
          } catch (e) {
            handleError(e, 'Error subscribing to newsletter', { skipTracking: true })
          }
        }

        trackTermsOfServiceSuccess({
          ethAddress: account,
          isGuest: false,
          email: state.email || undefined,
          name: state.username
        })

        const hasLauncher = await launchDesktopApp({})

        if (hasLauncher) {
          window.location.href = '/'
        } else {
          if (requestId && provider && flags[FeatureFlagsKeys.LOGIN_ON_SETUP]) {
            // If the site to be redirect to is a request site, we need to recover the request and sign in
            await signRequest(provider, requestId, account)
          } else {
            redirect()
          }
        }
      } catch (e) {
        const errorMessage = handleError(e, 'Error deploying profile')
        setDeployError(errorMessage)
        setDeploying(false)
      } finally {
        setIsProcessingMessage(false)
      }
    },
    [
      nameError,
      emailError,
      agreeError,
      state.username,
      state.email,
      account,
      identity,
      referrer,
      requestId,
      provider,
      flags,
      redirect,
      signRequest,
      trackClick,
      trackReferral,
      trackTermsOfServiceSuccess,
      isProcessingMessage
    ]
  )

  const handleTermsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked
    setState(prev => ({ ...prev, isTermsChecked: value }))
  }, [])

  const initializeAvatarSetup = useCallback(async () => {
    if (!account) {
      console.warn('No account found')
      return redirect()
    }

    const profile = await fetchProfile(account)

    if (profile && isProfileComplete(profile)) {
      console.warn('Profile already exists')
      return redirect()
    }

    if (flags[FeatureFlagsKeys.HTTP_AUTH]) {
      authServerClient.current = createAuthServerHttpClient()
    } else {
      authServerClient.current = createAuthServerWsClient()
    }

    if (provider?.isMagic) {
      try {
        const storedEmail = localStorage.getItem('dcl_magic_user_email')
        if (storedEmail) {
          setState(prev => ({ ...prev, email: storedEmail, isEmailInherited: true }))
          // Clear the stored email after using it
          localStorage.removeItem('dcl_magic_user_email')
        }
      } catch (error) {
        console.warn('Failed to get user email from localStorage:', error)
      }
    }

    if (referrer && EthAddress.validate(referrer) && !hasTrackedReferral.current) {
      await trackReferral(referrer, 'POST')
      hasTrackedReferral.current = true
    }

    setInitialized(true)
  }, [account, flags, provider, referrer, redirect, trackReferral])

  useEffect(() => {
    window.addEventListener('message', handleMessage, false)
    return () => {
      window.removeEventListener('message', handleMessage, false)
    }
  }, [handleMessage])

  useEffect(() => {
    if (isConnecting || !initializedFlags) return

    if (!account || !identity) {
      console.warn('No previous connection found')
      return navigate(locations.login(redirectTo, referrer))
    }

    initializeAvatarSetup()
  }, [initializeAvatarSetup, account, identity, isConnecting, initializedFlags, navigate, redirectTo])

  if (!initialized) {
    return (
      <MainContainer>
        <LoadingContainer>
          <DecentralandLogo />
          <LoadingTitle variant="h3">Confirming login...</LoadingTitle>
          <ProgressContainer>
            <CircularProgress color="inherit" />
          </ProgressContainer>
        </LoadingContainer>
      </MainContainer>
    )
  }

  return (
    <MainContainer>
      <BackgroundShadow />
      <LeftFormSection>
        <DecentralandLogo />

        <WelcomeContainer>
          <WelcomeTitle variant="h3">
            Welcome to <DecentralandText>Decentraland!</DecentralandText>
          </WelcomeTitle>
        </WelcomeContainer>

        <InputContainer>
          <InputLabel variant="h5">Username*</InputLabel>
          <TextInput
            variant="outlined"
            placeholder="Enter your username"
            value={state.username}
            onChange={handleUsernameChange}
            hasError={hasError}
          />
          <CharacterCounterComponent characterCount={characterCount} maxCharacters={MAX_CHARACTERS} hasError={hasError} />
        </InputContainer>

        {!state.isEmailInherited && (
          <InputContainer>
            <InputLabel variant="h5">Email</InputLabel>
            <TextInput
              variant="outlined"
              placeholder="Enter your email"
              value={state.email}
              onChange={handleEmailChange}
              hasError={state.hasEmailError}
            />
            <EmailDescription>Subscribe to Decentraland's newsletter for updates on features, events, contests, and more.</EmailDescription>
          </InputContainer>
        )}

        <CheckboxContainer>
          {state.isEmailInherited && (
            <CheckboxRow id="marketing" label="I want to receive marketing and updates" control={<CheckboxInput />} />
          )}
          <CheckboxRow
            id="terms"
            label={
              <>
                I agree with Decentraland's <LinkCheckbox href="https://decentraland.org/terms/">Terms of Use</LinkCheckbox> and{' '}
                <LinkCheckbox href="https://decentraland.org/privacy">Privacy Policy</LinkCheckbox>
                .*
              </>
            }
            control={<CheckboxInput checked={state.isTermsChecked} onChange={handleTermsChange} />}
          />
        </CheckboxContainer>

        <ContinueButton
          variant="contained"
          onClick={handleContinueClick}
          disabled={!!nameError || !!emailError || !!agreeError || !state.username || !state.isTermsChecked || deploying}
        >
          {deploying ? 'DEPLOYING...' : 'CUSTOMIZE MY AVATAR'}
        </ContinueButton>

        {showErrors && nameError && (
          <InputLabel color="error" sx={{ mt: 1, fontSize: '14px' }}>
            {nameError}
          </InputLabel>
        )}
        {showErrors && emailError && (
          <InputLabel color="error" sx={{ mt: 1, fontSize: '14px' }}>
            {emailError}
          </InputLabel>
        )}
        {showErrors && agreeError && (
          <InputLabel color="error" sx={{ mt: 1, fontSize: '14px' }}>
            {agreeError}
          </InputLabel>
        )}
        {deployError && (
          <InputLabel color="error" sx={{ mt: 2, fontSize: '14px' }}>
            An error occurred while creating your profile: {deployError}
          </InputLabel>
        )}
      </LeftFormSection>

      <RightAvatarSection>
        <RightSectionBackground />
        {!isAvatarParticlesAnimationEnded && (
          <AvatarParticles
            animationData={avatarParticles}
            loop={false}
            onComplete={() => {
              setIsAvatarParticlesAnimationEnded(true)
            }}
            show={!isAvatarParticlesAnimationEnded}
          />
        )}
        <AvatarParticles animationData={avatarFloat} loop={true} show={isAvatarParticlesAnimationEnded} />
      </RightAvatarSection>

      <PreloadedWearableContainer isVisible={state.showWearablePreview}>
        <WearablePreview
          id="avatar-preview-configurator"
          unity={true}
          unityMode={PreviewUnityMode.Configurator}
          baseUrl="https://wearable-preview-git-feat-update-unity-ren-aade4d-decentraland1.vercel.app"
        />
      </PreloadedWearableContainer>
    </MainContainer>
  )
}

export { AvatarSetupPage }
