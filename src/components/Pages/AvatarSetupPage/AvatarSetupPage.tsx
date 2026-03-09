// eslint-disable-next-line @typescript-eslint/naming-convention
import * as React from 'react'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '@dcl/hooks'
import { EthAddress } from '@dcl/schemas'
import { PreviewUnityMode } from '@dcl/schemas/dist/dapps/preview'
import { CircularProgress, WearablePreview, launchDesktopApp } from 'decentraland-ui2'
import avatarFloat from '../../../assets/animations/AvatarFloat_Lottie.json'
import avatarParticles from '../../../assets/animations/AvatarParticles_Lottie.json'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useSignRequest } from '../../../hooks/useSignRequest'
import { useTrackReferral } from '../../../hooks/useTrackReferral'
import { config } from '../../../modules/config'
import { fetchProfile } from '../../../modules/profile'
import { IpValidationError, createAuthServerHttpClient, createAuthServerWsClient } from '../../../shared/auth'
import { useCurrentConnectionData } from '../../../shared/connection/hooks'
import { isEmailValid } from '../../../shared/email'
import { locations } from '../../../shared/locations'
import { getStoredEmail } from '../../../shared/onboarding/getStoredEmail'
import { trackCheckpoint } from '../../../shared/onboarding/trackCheckpoint'
import { isProfileComplete } from '../../../shared/profile'
import { handleError } from '../../../shared/utils/errorHandler'
import { checkWebGpuSupport } from '../../../shared/utils/webgpu'
import { AnimatedBackground } from '../../AnimatedBackground'
import { CharacterCounterComponent } from '../../CharacterCounter'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { subscribeToNewsletter } from '../SetupPage/utils'
import { deployProfileFromAvatarShape } from './utils'
import { AvatarSetupState, AvatarShape } from './AvatarSetupPage.types'
import {
  AvatarParticles,
  BackgroundShadow,
  CheckboxContainer,
  CheckboxInput,
  CheckboxRow,
  ContinueButton,
  DecentralandLogo,
  DecentralandText,
  EmailDescription,
  ErrorBox,
  ErrorBoxDescription,
  ErrorBoxDetail,
  ErrorBoxTitle,
  ErrorContainer,
  ErrorText,
  InputContainer,
  InputLabel,
  LeftFormSection,
  LinkCheckbox,
  LoadingContainer,
  LoadingTitle,
  MainContainer,
  PreloadedWearableContainer,
  ProgressContainer,
  RightAvatarSection,
  RightSectionBackground,
  TextInput,
  WarningIcon,
  WelcomeContainer,
  WelcomeTitle
} from './AvatarSetupPage.styled'

const MAX_CHARACTERS = 15

const AvatarSetupPage: React.FC = () => {
  const { t } = useTranslation()
  const hasTrackedReferral = useRef(false)
  const [urlSearchParams] = useSearchParams()
  const { flags, initialized: initializedFlags } = useContext(FeatureFlagsContext)
  const [initialized, setInitialized] = useState(false)
  const { url: redirectTo, redirect } = useAfterLoginRedirection()
  const { isLoading: isConnecting, account, identity, provider } = useCurrentConnectionData()
  const { signRequest, authServerClient } = useSignRequest(redirect)
  const navigate = useNavigateWithSearchParams()
  const referrer = urlSearchParams.get('referrer')
  const { track: trackReferral } = useTrackReferral()
  const { trackAvatarEditSuccess, trackTermsOfServiceSuccess, trackCheckTermsOfService } = useAnalytics()

  const [state, setState] = useState<AvatarSetupState>({
    username: sessionStorage.getItem('dcl_avatar_setup_username') || '',
    email: sessionStorage.getItem('dcl_avatar_setup_email') || '',
    hasEmailError: false,
    showWearablePreview: false,
    isTermsChecked: sessionStorage.getItem('dcl_avatar_setup_is_terms_checked') === 'true' || false,
    isEmailInherited: false,
    hasWearablePreviewLoaded: false
  })

  const [deploying, setDeploying] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const isProcessingMessageRef = useRef(false)

  const [isAvatarParticlesAnimationEnded, setIsAvatarParticlesAnimationEnded] = useState(false)

  const requestId = useMemo(() => {
    const redirectTo = urlSearchParams.get('redirectTo')
    let requestId: string | null = null
    try {
      const url = new URL(redirectTo ?? '', window.location.origin)
      const regex = /^\/?auth\/requests\/([a-zA-Z0-9-]+)$/
      requestId = url.pathname.match(regex)?.[1] ?? null
    } catch {
      // Do nothing
    }
    return requestId
  }, [urlSearchParams])

  const characterCount = useMemo(() => state.username.length, [state.username])

  const isUsernameValid = useMemo(() => {
    return /^[a-zA-Z0-9]*$/.test(state.username)
  }, [state.username])

  const hasUsernameError = useMemo(() => characterCount > MAX_CHARACTERS || !isUsernameValid, [characterCount, isUsernameValid])

  const emailError = useMemo(() => {
    if (state.email && !state.email.includes('@')) {
      return t('avatar_setup.validation.email_invalid')
    }
    return ''
  }, [state.email, t])

  const agreeError = useMemo(() => {
    if (!state.isTermsChecked) {
      return t('avatar_setup.validation.agree_required')
    }
    return ''
  }, [state.isTermsChecked, t])

  /**
   * Handles the "Customize My Avatar" button click. This function runs twice:
   * 1. On user click: validates inputs and makes the WearablePreview iframe visible.
   * 2. Automatically via useEffect once the iframe finishes loading (hasWearablePreviewLoaded),
   *    at which point it's safe to send commands to the preview controller.
   *
   * @throws {Error} If the email is present but invalid — caught internally and displayed in the error box.
   */
  const handleContinueClick = useCallback(async () => {
    try {
      setError(null)

      // Validate email format and throw to display the error in the error box
      if (state.email && state.email !== '' && !isEmailValid(state.email)) {
        setState(prev => ({ ...prev, hasEmailError: true }))
        throw new Error(t('avatar_setup.validation.email_invalid'))
      }

      setState(prev => ({ ...prev, hasEmailError: false, showWearablePreview: true }))

      // Only interact with the preview controller once the iframe has loaded.
      // On first click, hasWearablePreviewLoaded is false — the useEffect watching
      // it will call handleContinueClick again once the preview is ready.
      if (state.hasWearablePreviewLoaded) {
        const wearablePreviewController = WearablePreview.createController('avatar-preview-configurator')
        await wearablePreviewController.scene.setUsername(state.username)

        // Only track once the preview is loaded to avoid double-firing,
        // since this function runs twice (on click + on preview load).
        trackTermsOfServiceSuccess({
          ethAddress: account,
          isGuest: false,
          email: state.email || undefined,
          name: state.username
        })
      }
    } catch (e) {
      // Display the error in the error box below the continue button
      const errorMessage = handleError(e, 'Error setting up avatar')
      setError(errorMessage)
      // Reset preview state so the user can retry after an error
      setState(prev => ({ ...prev, showWearablePreview: false, hasWearablePreviewLoaded: false }))
    }
  }, [state.username, state.email, state.hasWearablePreviewLoaded, account, trackTermsOfServiceSuccess, t])

  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setState(prev => ({ ...prev, username: value }))
    sessionStorage.setItem('dcl_avatar_setup_username', value)
  }, [])

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setState(prev => ({ ...prev, email: value, hasEmailError: false }))
    sessionStorage.setItem('dcl_avatar_setup_email', value)
  }, [])

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (event.data.type !== 'controller_response' || event.data.payload.id !== 'customization-done') return

      // Prevent multiple simultaneous executions
      if (isProcessingMessageRef.current) {
        console.log('Message already being processed, skipping...')
        return
      }

      const avatarShape = event.data.payload.result as AvatarShape

      // If any of the fields has an error, don't submit
      if (emailError || agreeError || !isUsernameValid) {
        return
      }

      // These refs should have values at this point
      if (!account || !identity) {
        console.warn('No account or identity found.')
        return
      }

      try {
        isProcessingMessageRef.current = true
        setDeploying(true)
        setError(null)

        // Deploy a new profile for the user based on the custom avatar shape
        await deployProfileFromAvatarShape({
          connectedAccount: account,
          connectedAccountIdentity: identity,
          avatarShape: avatarShape,
          deploymentProfileName: state.username
        })

        trackAvatarEditSuccess({
          ethAddress: account,
          isGuest: false,
          profile: state.username,
          avatarShape
        })

        trackCheckpoint({
          checkpointId: 3,
          action: 'completed',
          source: 'auth',
          userIdentifier: account.toLowerCase(),
          identifierType: 'wallet',
          email: state.email || undefined
        })

        if (referrer && EthAddress.validate(referrer)) {
          try {
            await trackReferral(referrer, 'PATCH')
          } catch {
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

        const storedEmail = localStorage.getItem('dcl_magic_user_email')
        if (storedEmail) {
          // Clear the stored email after using it
          localStorage.removeItem('dcl_magic_user_email')
        }
        sessionStorage.removeItem('dcl_avatar_setup_username')
        sessionStorage.removeItem('dcl_avatar_setup_email')
        sessionStorage.removeItem('dcl_avatar_setup_is_terms_checked')

        const hasLauncher = await launchDesktopApp({})

        if (hasLauncher) {
          navigate('/')
        } else {
          // If the site has a request, sign it first
          if (requestId && provider && flags[FeatureFlagsKeys.LOGIN_ON_SETUP]) {
            await signRequest(provider, requestId, account)
          } else {
            redirect({ user: account }, config.get('DOWNLOAD_URL'))
          }
        }
      } catch (e) {
        if (e instanceof IpValidationError) {
          const errorMessage = handleError(e, 'IP validation failed')
          setError(errorMessage)
        } else {
          const errorMessage = handleError(e, 'Error deploying profile')
          setError(errorMessage)
        }
        setDeploying(false)
      } finally {
        isProcessingMessageRef.current = false
      }
    },
    [
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
      trackAvatarEditSuccess,
      trackReferral
    ]
  )

  const handleTermsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.checked
      if (value) {
        trackCheckTermsOfService()
        sessionStorage.setItem('dcl_avatar_setup_is_terms_checked', 'true')
      }
      setState(prev => ({ ...prev, isTermsChecked: value }))
    },
    [trackCheckTermsOfService]
  )

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

    authServerClient.current = flags[FeatureFlagsKeys.HTTP_AUTH] ? createAuthServerHttpClient() : createAuthServerWsClient()

    // Try to get stored email from web2 auth (Magic or Thirdweb)
    const storedEmail = getStoredEmail()
    if (storedEmail) {
      setState(prev => ({ ...prev, email: storedEmail, isEmailInherited: true }))
    }

    trackCheckpoint({
      checkpointId: 3,
      action: 'reached',
      source: 'auth',
      userIdentifier: account.toLowerCase(),
      identifierType: 'wallet',
      email: storedEmail || undefined
    })

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
  }, [handleMessage, handleContinueClick])

  useEffect(() => {
    if (state.username !== '' && state.isTermsChecked && state.hasWearablePreviewLoaded && !state.hasEmailError) {
      handleContinueClick()
    }
  }, [state.hasWearablePreviewLoaded])

  useEffect(() => {
    if (isConnecting || !initializedFlags) return

    if (!account || !identity) {
      console.warn('No previous connection found')
      return navigate(locations.login(redirectTo, referrer))
    }

    checkWebGpuSupport().then(hasWebGPU => {
      if (!hasWebGPU) {
        return navigate(locations.setup(redirectTo, referrer))
      }
      initializeAvatarSetup()
    })
  }, [initializeAvatarSetup, account, identity, isConnecting, initializedFlags, navigate, redirectTo, referrer])

  if (!initialized) {
    return (
      <MainContainer>
        <AnimatedBackground variant="absolute" />
        <LoadingContainer>
          <DecentralandLogo />
          <LoadingTitle variant="h3">{t('avatar_setup.confirming_login')}</LoadingTitle>
          <ProgressContainer>
            <CircularProgress color="inherit" />
          </ProgressContainer>
        </LoadingContainer>
      </MainContainer>
    )
  }

  return (
    <MainContainer>
      <AnimatedBackground variant="absolute" />
      <BackgroundShadow />
      <LeftFormSection>
        <DecentralandLogo />

        <WelcomeContainer>
          <WelcomeTitle variant="h3">
            {t('avatar_setup.welcome_to')}
            <DecentralandText>{t('avatar_setup.decentraland')}</DecentralandText>
          </WelcomeTitle>
        </WelcomeContainer>

        <InputContainer>
          <InputLabel variant="h5">
            {t('avatar_setup.username_label')}
            {state.isEmailInherited ? '' : '*'}
          </InputLabel>
          <TextInput
            variant="outlined"
            placeholder={t('avatar_setup.username_placeholder')}
            value={state.username}
            onChange={handleUsernameChange}
            hasError={hasUsernameError}
          />
          <CharacterCounterComponent
            characterCount={characterCount}
            maxCharacters={MAX_CHARACTERS}
            hasError={characterCount > MAX_CHARACTERS}
          />
          {!isUsernameValid && (
            <ErrorContainer>
              <WarningIcon />
              <ErrorText>{t('avatar_setup.only_letters_numbers')}</ErrorText>
            </ErrorContainer>
          )}
        </InputContainer>

        {!state.isEmailInherited && (
          <InputContainer>
            <InputLabel variant="h5">{t('avatar_setup.email_label')}</InputLabel>
            <TextInput
              variant="outlined"
              placeholder={t('avatar_setup.email_placeholder')}
              value={state.email}
              onChange={handleEmailChange}
              hasError={state.hasEmailError}
            />
            <EmailDescription>{t('avatar_setup.email_newsletter')}</EmailDescription>
          </InputContainer>
        )}

        <CheckboxContainer>
          {state.isEmailInherited && <CheckboxRow id="marketing" label={t('avatar_setup.email_newsletter')} control={<CheckboxInput />} />}
          <CheckboxRow
            id="terms"
            label={
              <>
                {t('avatar_setup.terms_agree_prefix')}
                <LinkCheckbox href="https://decentraland.org/terms/" target="_blank">
                  {t('avatar_setup.terms_of_use')}
                </LinkCheckbox>
                {t('avatar_setup.and')}
                <LinkCheckbox href="https://decentraland.org/privacy" target="_blank">
                  {t('avatar_setup.privacy_policy')}
                </LinkCheckbox>
                {t('avatar_setup.terms_required_suffix')}
              </>
            }
            control={<CheckboxInput checked={state.isTermsChecked} onChange={handleTermsChange} />}
          />
        </CheckboxContainer>

        <ContinueButton
          variant="contained"
          onClick={handleContinueClick}
          disabled={
            !!hasUsernameError ||
            !isUsernameValid ||
            !!emailError ||
            !!agreeError ||
            !state.username ||
            !state.isTermsChecked ||
            deploying ||
            !state.hasWearablePreviewLoaded
          }
        >
          {deploying ? t('avatar_setup.deploying') : t('avatar_setup.customize_avatar')}
        </ContinueButton>

        {error && (
          <ErrorBox>
            <ErrorBoxTitle>{t('avatar_setup.error_title')}</ErrorBoxTitle>
            <ErrorBoxDescription>{t('avatar_setup.error_description')}</ErrorBoxDescription>
            <ErrorBoxDetail>{error}</ErrorBoxDetail>
          </ErrorBox>
        )}
      </LeftFormSection>

      <RightAvatarSection>
        <RightSectionBackground />
        <AvatarParticles
          animationData={avatarParticles}
          loop={false}
          onComplete={() => {
            setIsAvatarParticlesAnimationEnded(true)
          }}
          show={!isAvatarParticlesAnimationEnded}
        />
        <AvatarParticles animationData={avatarFloat} loop={true} show={isAvatarParticlesAnimationEnded} />
      </RightAvatarSection>

      <PreloadedWearableContainer isVisible={state.showWearablePreview}>
        <WearablePreview
          id="avatar-preview-configurator"
          unity={true}
          unityMode={PreviewUnityMode.CONFIG}
          onLoad={() => {
            setState(prev => ({ ...prev, hasWearablePreviewLoaded: true }))
          }}
        />
      </PreloadedWearableContainer>
    </MainContainer>
  )
}

export { AvatarSetupPage }
