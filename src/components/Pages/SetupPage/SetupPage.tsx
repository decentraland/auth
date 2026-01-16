import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import classNames from 'classnames'
import { EthAddress } from '@dcl/schemas'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Checkbox } from 'decentraland-ui/dist/components/Checkbox/Checkbox'
import { Field } from 'decentraland-ui/dist/components/Field/Field'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { useMobileMediaQuery } from 'decentraland-ui/dist/components/Media/Media'
import { InputOnChangeData } from 'decentraland-ui'
import backImg from '../../../assets/images/back.svg'
import diceImg from '../../../assets/images/dice.svg'
import logoImg from '../../../assets/images/logo.svg'
import wrongImg from '../../../assets/images/wrong.svg'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useSignRequest } from '../../../hooks/useSignRequest'
import { useTrackReferral } from '../../../hooks/useTrackReferral'
import { ClickEvents } from '../../../modules/analytics/types'
import { fetchProfile } from '../../../modules/profile'
import { createAuthServerHttpClient, createAuthServerWsClient } from '../../../shared/auth'
import { useCurrentConnectionData } from '../../../shared/connection/hooks'
import { locations } from '../../../shared/locations'
import { isProfileComplete } from '../../../shared/profile'
import { handleError } from '../../../shared/utils/errorHandler'
import { ConnectionModal } from '../../ConnectionModal'
import { ConnectionLayoutState } from '../../ConnectionModal/ConnectionLayout.type'
import { CustomWearablePreview } from '../../CustomWearablePreview'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { DifferentAccountError } from '../RequestPage/Views/DifferentAccountError'
import { IpValidationError as IpValidationErrorView } from '../RequestPage/Views/IpValidationError'
import { RecoverError } from '../RequestPage/Views/RecoverError'
import { SignInComplete } from '../RequestPage/Views/SignInComplete'
import { SigningError } from '../RequestPage/Views/SigningError'
import { TimeoutError } from '../RequestPage/Views/TimeoutError'
import { deployProfileFromDefault, subscribeToNewsletter } from './utils'
import styles from './SetupPage.module.css'

enum View {
  RANDOMIZE,
  FORM,
  DIFFERENT_ACCOUNT,
  RECOVER_ERROR,
  SIGN_IN_COMPLETE,
  SIGNING_ERROR,
  TIMEOUT_ERROR,
  IP_VALIDATION_ERROR
}

function getRandomDefaultProfile() {
  return 'default' + (Math.floor(Math.random() * (160 - 1 + 1)) + 1)
}

const InputErrorMessage = (props: { message: string; className?: string }) => {
  return (
    <div className={classNames(styles.error, props.className)}>
      <img src={wrongImg} />
      <div>{props.message}</div>
    </div>
  )
}

const DeployErrorMessage = (props: { message: string }) => (
  <div className={styles.errorMessage}>
    <h4>An error occurred while creating your account</h4>
    <p>Please, contact support with the following error message:</p>
    <p>{props.message}</p>
  </div>
)

export const SetupPage = () => {
  const hasStartedToWriteSomethingInName = useRef(false)
  const hasStartedToWriteSomethingInEmail = useRef(false)
  const hasCheckedAgree = useRef(false)
  const hasTrackedReferral = useRef(false)
  const [urlSearchParams] = useSearchParams()
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false)
  const { flags, initialized: initializedFlags } = useContext(FeatureFlagsContext)
  const [initialized, setInitialized] = useState(false)
  const [view, setView] = useState(View.RANDOMIZE)
  const [profile, setProfile] = useState(getRandomDefaultProfile())
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)
  const isMobile = useMobileMediaQuery()
  const { url: redirectTo, redirect } = useAfterLoginRedirection()
  const { isLoading: isConnecting, account, identity, provider, providerType } = useCurrentConnectionData()
  const navigate = useNavigateWithSearchParams()
  const referrer = urlSearchParams.get('referrer')
  const {
    trackClick,
    trackAvatarEditSuccess,
    trackTermsOfServiceSuccess,
    trackStartAddingName,
    trackStartAddingEmail,
    trackCheckTermsOfService
  } = useAnalytics()
  const { track: trackReferral } = useTrackReferral()

  const requestId = useMemo(() => {
    // Grab the request id from redirectTo parameter.
    const redirectTo = urlSearchParams.get('redirectTo')
    let requestId: string | null = null
    try {
      const url = new URL(redirectTo ?? '', window.location.origin)
      // Match the path: /auth/requests/0377e459-8fdf-4ce5-89f4-4f1f1c7bbb7f
      const regex = /^\/?auth\/requests\/([a-zA-Z0-9-]+)$/
      requestId = url.pathname.match(regex)?.[1] ?? null
    } catch (_e) {
      // Do nothing
    }
    return requestId
  }, [urlSearchParams])

  // Validate the name.
  const nameError = useMemo(() => {
    if (!name.length) {
      return 'Please enter your username.'
    }
    if (name.length >= 15) {
      return 'Sorry, usernames can have a maximum of 15 characters.'
    }

    if (name.includes(' ')) {
      return 'Sorry, spaces are not permitted.'
    }

    if (!/^[a-zA-Z0-9]+$/.test(name)) {
      return 'Sorry, special characters (!@#$%) are not permitted.'
    }

    return ''
  }, [name])

  // Validate the email.
  const emailError = useMemo(() => {
    if (email && !email.includes('@')) {
      return 'Invalid email, please try again.'
    }

    return ''
  }, [email])

  // Validate the agree checkbox.
  const agreeError = useMemo(() => {
    if (!agree) {
      return 'Please accept the terms of use and privacy policy.'
    }

    return ''
  }, [agree])

  // Message displayed on the button that completes the avatar creation.
  // Will display a message according to where the user will be redirected to.
  const continueMessage = useMemo(() => {
    if (redirectTo) {
      if (redirectTo.includes('play')) {
        return 'jump into decentraland'
      }

      const sites = ['marketplace', 'builder', 'account', 'profile', 'events', 'places', 'governance', 'dao', 'rewards']

      for (const site of sites) {
        if (redirectTo.includes(site)) {
          return `continue to ${site}`
        }
      }
    }

    return 'continue'
  }, [redirectTo])

  // Sets a random default profile.
  const handleRandomize = useCallback(() => {
    trackClick(ClickEvents.RANDOMIZE)
    setProfile(getRandomDefaultProfile())
  }, [trackClick])

  // Confirms the current default profile and goes to the form view.
  const handleContinue = useCallback(() => {
    trackAvatarEditSuccess({
      ethAddress: account,
      isGuest: false,
      profile
    })

    setView(View.FORM)
  }, [profile, account, trackAvatarEditSuccess])

  // Goes back into the randomize view to select a new default profile.
  const handleBack = useCallback(() => {
    // Clear input values.
    setName('')
    setEmail('')
    setAgree(false)
    setShowErrors(false)
    setDeployError(null)

    trackClick(ClickEvents.BACK_TO_AVATAR_RANDOMIZATION_VIEW)

    setView(View.RANDOMIZE)
  }, [trackClick])

  // Form input handlers.
  const handleNameChange = useCallback(
    (_e: unknown, data: InputOnChangeData) => {
      setName(data.value)
      if (!hasStartedToWriteSomethingInName.current) {
        trackStartAddingName()
        hasStartedToWriteSomethingInName.current = true
      }
    },
    [trackStartAddingName]
  )
  const handleEmailChange = useCallback(
    (_e: unknown, data: InputOnChangeData) => {
      setEmail(data.value)
      if (!hasStartedToWriteSomethingInEmail.current) {
        trackStartAddingEmail()
        hasStartedToWriteSomethingInEmail.current = true
      }
    },
    [trackStartAddingEmail]
  )
  const handleAgreeChange = useCallback(() => {
    setAgree(prev => !prev)
    if (!hasCheckedAgree.current) {
      trackCheckTermsOfService()
      hasCheckedAgree.current = true
    }
  }, [trackCheckTermsOfService])

  const { signRequest, authServerClient } = useSignRequest(redirect, {
    onExpiredRequest: () => setView(View.TIMEOUT_ERROR),
    onRecoverError: error => {
      setRequestError(error)
      setView(View.RECOVER_ERROR)
    },
    onSigningError: error => {
      setRequestError(error)
      setView(View.SIGNING_ERROR)
    },
    onIpValidationError: error => {
      setRequestError(error)
      setView(View.IP_VALIDATION_ERROR)
    },
    onSuccess: () => setView(View.SIGN_IN_COMPLETE),
    onConnectionModalOpen: () => setIsConnectionModalOpen(true),
    onConnectionModalClose: () => setIsConnectionModalOpen(false)
  })

  // Handles the deployment of a new profile based on the selected default profile.
  // Also subscribes the user to the newsletter if an email is provided.
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()

      trackClick(ClickEvents.SUBMIT_PROFILE)

      setShowErrors(true)

      // If any of the fields has an error, don't submit.
      if (nameError || emailError || agreeError) {
        return
      }

      // These refs should have values at this point.
      // If they don't, it means that there was something wrong on the initialization effect.
      if (!account || !identity) {
        console.warn('No account or identity found.')
        return
      }

      try {
        setDeploying(true)
        setDeployError(null)

        // Deploy a new profile for the user based on the selected default profile.
        await deployProfileFromDefault({
          connectedAccount: account,
          connectedAccountIdentity: identity,
          defaultProfile: profile,
          deploymentProfileName: name
        })

        if (referrer && EthAddress.validate(referrer)) {
          try {
            await trackReferral(referrer, 'PATCH')
          } catch (error) {
            // Error is already handled in trackReferral
          }
        }

        // Subscribe to the newsletter only if the user has provided an email.
        if (email) {
          // Given that the subscription is an extra step, we don't want to block the user if it fails.
          try {
            await subscribeToNewsletter(email)
          } catch (e) {
            handleError(e, 'Error subscribing to newsletter', { skipTracking: true })
          }
        }

        trackTermsOfServiceSuccess({
          ethAddress: account,
          isGuest: false,
          email: email || undefined,
          name
        })

        // If the site to be redirect to is a request site, we need to recover the request and sign in.
        if (requestId && provider && flags[FeatureFlagsKeys.LOGIN_ON_SETUP]) {
          await signRequest(provider, requestId, account)
        } else {
          redirect()
        }
      } catch (e) {
        const errorMessage = handleError(e, 'Error deploying profile')
        setDeployError(errorMessage)
        setDeploying(false)
      }
    },
    [
      nameError,
      requestId,
      emailError,
      agreeError,
      name,
      email,
      agree,
      profile,
      provider,
      referrer,
      flags[FeatureFlagsKeys.LOGIN_ON_SETUP],
      redirect,
      signRequest,
      trackClick,
      trackTermsOfServiceSuccess,
      account,
      identity
    ]
  )

  // Initialization effect.
  // Will run some checks to see if the user can proceed with the simplified avatar setup flow.
  useEffect(() => {
    if (isConnecting || !initializedFlags) return

    if (!account || !identity) {
      console.warn('No previous connection found')
      return navigate(locations.login(redirectTo))
    }

    ;(async () => {
      // Check if the wallet is connected.
      const profile = await fetchProfile(account)

      // Check that the connected account does not have a profile already.
      if (profile && isProfileComplete(profile)) {
        console.warn('Profile already exists')
        return redirect()
      }

      authServerClient.current = flags[FeatureFlagsKeys.HTTP_AUTH] ? createAuthServerHttpClient() : createAuthServerWsClient()

      // Try to get stored email from web2 auth (Magic or Thirdweb)
      try {
        const storedEmail = localStorage.getItem('dcl_thirdweb_user_email') || localStorage.getItem('dcl_magic_user_email')
        if (storedEmail) {
          setEmail(storedEmail)
        }
      } catch (error) {
        console.warn('Failed to get user email from localStorage:', error)
      }

      if (referrer && EthAddress.validate(referrer) && !hasTrackedReferral.current) {
        try {
          await trackReferral(referrer, 'POST')
          hasTrackedReferral.current = true
        } catch (error) {
          // Error is already handled in trackReferral
        }
      }

      setInitialized(true)
    })()
  }, [redirect, navigate, account, identity, isConnecting, initializedFlags, flags, referrer, provider])

  if (!initialized) {
    return (
      <div className={styles.container}>
        <div className={styles.background} />
        <Loader active size="huge" />
      </div>
    )
  }

  switch (view) {
    case View.DIFFERENT_ACCOUNT:
      return <DifferentAccountError requestId={requestId ?? ''} />
    case View.RECOVER_ERROR:
      return <RecoverError error={requestError} />
    case View.SIGN_IN_COMPLETE:
      return <SignInComplete />
    case View.SIGNING_ERROR:
      return <SigningError error={requestError} />
    case View.TIMEOUT_ERROR:
      return <TimeoutError requestId={requestId ?? ''} />
    case View.IP_VALIDATION_ERROR:
      return <IpValidationErrorView requestId={requestId ?? ''} reason={requestError || 'Unknown error'} />
    case View.RANDOMIZE:
      return (
        <div className={styles.container}>
          <div className={styles.background} />
          <div className={isMobile ? styles.mobileContainer : styles.left}>
            <div className={isMobile ? undefined : styles.leftInner}>
              <img className={styles.logo} src={logoImg} alt="logo" />
              <div className={styles.title}>Welcome to Decentraland!</div>

              {!isMobile && <div className={styles.subtitle}>Your journey begins here</div>}

              <div className={styles.meetYourAvatar}>First, Meet Your Avatar</div>
              <div className={styles.meetYourAvatarDescription}>
                {isMobile ? (
                  <>
                    Choose an avatar to start your journey.
                    <br />
                    <b>You can customize it later on desktop</b>, where all the magic happens!
                  </>
                ) : (
                  <>
                    Say hi to your new digital self!
                    <br />
                    Don't worry, of course they're not quite 'you' yet—soon you'll be able to customize them to your heart's content.
                  </>
                )}
              </div>

              {isMobile && (
                <div className={styles.mobilePreviewContainer}>
                  <div className={styles.mobilePreviewOverlay}></div>
                  <CustomWearablePreview profile={profile} />
                </div>
              )}

              <div className={isMobile ? styles.mobileButtons : undefined}>
                <div className={styles.randomize}>
                  <Button compact inverted onClick={handleRandomize}>
                    <img src={diceImg} alt="diceImg" />
                    <span>randomize</span>
                  </Button>
                </div>
                <div className={styles.continue}>
                  <Button compact={isMobile} primary fluid={!isMobile} onClick={handleContinue}>
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {!isMobile && (
            <div className={styles.right}>
              <CustomWearablePreview profile={profile} />
            </div>
          )}
        </div>
      )
    default:
      return (
        <div className={styles.container}>
          <div className={styles.background} />
          <ConnectionModal
            open={isConnectionModalOpen}
            state={ConnectionLayoutState.WAITING_FOR_SIGNATURE}
            providerType={providerType ?? null}
            onTryAgain={() => undefined}
          />
          <div className={isMobile ? styles.mobileContainer : styles.left}>
            <div className={isMobile ? undefined : styles.leftInner}>
              {!isMobile && <img className={styles.logoSmall} src={logoImg} alt="logo" />}
              <div className={styles.back} onClick={handleBack}>
                <img src={backImg} alt="backImg" />
                <span>BACK</span>
              </div>
              <div className={styles.title}>Complete your Profile</div>
              <form onSubmit={handleSubmit}>
                <div className={styles.name}>
                  <Field
                    label="Username"
                    placeholder="Enter your username"
                    onChange={handleNameChange}
                    value={name}
                    message={showErrors && nameError ? <InputErrorMessage message={nameError} /> : undefined}
                  />
                </div>
                <div>
                  <Field
                    label="Email (optional)"
                    placeholder="Enter your email"
                    value={email}
                    message={
                      <>
                        {showErrors && emailError ? <InputErrorMessage className={styles.emailError} message={emailError} /> : null}
                        <span>
                          Subscribe to Decentraland's newsletter to receive the latest news about events, updates, contests and more.
                        </span>
                      </>
                    }
                    onChange={handleEmailChange}
                  />
                </div>
                <div className={styles.agree}>
                  <Checkbox onChange={handleAgreeChange} checked={agree} />
                  <div>
                    I agree with Decentraland's&nbsp;
                    <a target="_blank" rel="noopener noreferrer" href="https://decentraland.org/terms/">
                      Terms of use
                    </a>
                    &nbsp;and&nbsp;
                    <a target="_blank" rel="noopener noreferrer" href="https://decentraland.org/privacy">
                      Privacy policy
                    </a>
                    .
                  </div>
                </div>
                {showErrors && agreeError ? <InputErrorMessage className={styles.agreeError} message={agreeError} /> : null}
                <div className={styles.jumpIn}>
                  <Button primary fluid type="submit" disabled={!agree || deploying} loading={deploying}>
                    {continueMessage}
                  </Button>
                </div>
              </form>
              {deployError ? <DeployErrorMessage message={deployError} /> : null}
            </div>
          </div>
          {!isMobile && (
            <div className={styles.right}>
              <CustomWearablePreview profile={profile} />
            </div>
          )}
        </div>
      )
  }
}
