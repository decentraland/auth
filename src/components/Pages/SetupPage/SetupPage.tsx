import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import classNames from 'classnames'
import { useTranslation } from '@dcl/hooks'
import { Button, CircularProgress, useMobileMediaQuery } from 'decentraland-ui2'
import backImg from '../../../assets/images/back.svg'
import diceImg from '../../../assets/images/dice.svg'
import logoImg from '../../../assets/images/logo.svg'
import wrongImg from '../../../assets/images/wrong.svg'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { usePostSignupActions } from '../../../hooks/usePostSignupActions'
import { useRequestIdFromRedirect } from '../../../hooks/useRequestIdFromRedirect'
import { useRequireAuth } from '../../../hooks/useRequireAuth'
import { useSetupFormValidation } from '../../../hooks/useSetupFormValidation'
import { useSignRequest } from '../../../hooks/useSignRequest'
import { ClickEvents } from '../../../modules/analytics/types'
import { fetchProfile } from '../../../modules/profile'
import { createAuthServerHttpClient, createAuthServerWsClient } from '../../../shared/auth'
import { locations } from '../../../shared/locations'
import { isProfileComplete } from '../../../shared/profile'
import { handleError } from '../../../shared/utils/errorHandler'
import { ConnectionModal } from '../../ConnectionModal'
import { ConnectionLayoutState } from '../../ConnectionModal/ConnectionLayout.type'
import { CustomWearablePreview } from '../../CustomWearablePreview'
import { FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { DifferentAccountError } from '../RequestPage/Views/DifferentAccountError'
import { IpValidationError as IpValidationErrorView } from '../RequestPage/Views/IpValidationError'
import { RecoverError } from '../RequestPage/Views/RecoverError'
import { SignInComplete } from '../RequestPage/Views/SignInComplete'
import { SigningError } from '../RequestPage/Views/SigningError'
import { TimeoutError } from '../RequestPage/Views/TimeoutError'
import { deployProfileFromDefault } from './utils'
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

const DeployErrorMessage = (props: { message: string; titleText: string; descriptionText: string }) => (
  <div className={styles.errorMessage}>
    <h4>{props.titleText}</h4>
    <p>{props.descriptionText}</p>
    <p>{props.message}</p>
  </div>
)

export const SetupPage = () => {
  const { t } = useTranslation()
  const hasStartedToWriteSomethingInName = useRef(false)
  const hasStartedToWriteSomethingInEmail = useRef(false)
  const hasCheckedAgree = useRef(false)
  const [urlSearchParams] = useSearchParams()
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false)
  const { isReady, isAuthenticated, flags, account, identity, provider, providerType } = useRequireAuth()
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
  const { trackReferralOnDeploy, trackReferralOnInit, subscribeEmail } = usePostSignupActions(referrer)

  const requestId = useRequestIdFromRedirect()

  const { nameError, emailError, agreeError } = useSetupFormValidation(name, email, agree)

  // Message displayed on the button that completes the avatar creation.
  // Will display a message according to where the user will be redirected to.
  const continueMessage = useMemo(() => {
    if (redirectTo) {
      if (redirectTo.includes('play')) {
        return t('setup.jump_into_decentraland')
      }

      const sites = ['marketplace', 'builder', 'account', 'profile', 'events', 'places', 'governance', 'dao', 'rewards']

      for (const site of sites) {
        if (redirectTo.includes(site)) {
          return t('setup.continue_to', { site })
        }
      }
    }

    return t('common.continue').toLowerCase()
  }, [redirectTo, t])

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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value)
      if (!hasStartedToWriteSomethingInName.current) {
        trackStartAddingName()
        hasStartedToWriteSomethingInName.current = true
      }
    },
    [trackStartAddingName]
  )
  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value)
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

        await trackReferralOnDeploy()
        await subscribeEmail(email)

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
      flags[FeatureFlagsKeys.LOGIN_ON_SETUP],
      redirect,
      signRequest,
      trackClick,
      trackTermsOfServiceSuccess,
      trackReferralOnDeploy,
      subscribeEmail,
      account,
      identity
    ]
  )

  // Initialization effect.
  // Will run some checks to see if the user can proceed with the simplified avatar setup flow.
  useEffect(() => {
    if (!isReady) return

    if (!isAuthenticated) {
      console.warn('No previous connection found')
      return navigate(locations.login(redirectTo))
    }

    ;(async () => {
      // Check if the wallet is connected.
      const profile = await fetchProfile(account!)

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

      await trackReferralOnInit()

      setInitialized(true)
    })()
  }, [redirect, navigate, account, identity, isReady, isAuthenticated, flags, provider, trackReferralOnInit])

  if (!initialized) {
    return (
      <div className={styles.container}>
        <div className={styles.background} />
        <CircularProgress size={60} />
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
              <div className={styles.title}>{t('setup.welcome')}</div>

              {!isMobile && <div className={styles.subtitle}>{t('setup.journey_begins')}</div>}

              <div className={styles.meetYourAvatar}>{t('setup.meet_avatar')}</div>
              <div className={styles.meetYourAvatarDescription}>
                {isMobile ? (
                  <>
                    {t('setup.meet_avatar_description_mobile')}
                    <br />
                    <b>{t('setup.meet_avatar_description_mobile_bold')}</b>
                    {t('setup.meet_avatar_description_mobile_suffix')}
                  </>
                ) : (
                  <>
                    {t('setup.meet_avatar_description_desktop').split('\n')[0]}
                    <br />
                    {t('setup.meet_avatar_description_desktop').split('\n')[1]}
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
                  <Button variant="outlined" size="small" onClick={handleRandomize} className={styles.randomizeButton}>
                    <img src={diceImg} alt="diceImg" />
                    <span>{t('setup.randomize')}</span>
                  </Button>
                </div>
                <div className={styles.continue}>
                  <Button variant="contained" size={isMobile ? 'small' : 'medium'} fullWidth={!isMobile} onClick={handleContinue}>
                    {t('common.continue')}
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
                <span>{t('common.back')}</span>
              </div>
              <div className={styles.title}>{t('setup.complete_profile')}</div>
              <form onSubmit={handleSubmit}>
                <div className={styles.name}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>{t('setup.username_label')}</label>
                    <input
                      className={styles.fieldInput}
                      placeholder={t('setup.username_placeholder')}
                      onChange={handleNameChange}
                      value={name}
                    />
                    {showErrors && nameError ? (
                      <div className={styles.fieldMessage}>
                        <InputErrorMessage message={nameError} />
                      </div>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>{t('setup.email_label')}</label>
                    <input
                      className={styles.fieldInput}
                      placeholder={t('setup.email_placeholder')}
                      value={email}
                      onChange={handleEmailChange}
                    />
                    <div className={styles.fieldMessage}>
                      {showErrors && emailError ? <InputErrorMessage className={styles.emailError} message={emailError} /> : null}
                      <span>{t('setup.email_newsletter')}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.agree}>
                  <input type="checkbox" onChange={handleAgreeChange} checked={agree} className={styles.checkbox} />
                  <div>
                    {t('setup.agree_prefix')}
                    <a target="_blank" rel="noopener noreferrer" href="https://decentraland.org/terms/">
                      {t('setup.terms_of_use')}
                    </a>
                    {t('setup.and')}
                    <a target="_blank" rel="noopener noreferrer" href="https://decentraland.org/privacy">
                      {t('setup.privacy_policy')}
                    </a>
                    .
                  </div>
                </div>
                {showErrors && agreeError ? <InputErrorMessage className={styles.agreeError} message={agreeError} /> : null}
                <div className={styles.jumpIn}>
                  <Button variant="contained" fullWidth type="submit" disabled={!agree || deploying}>
                    {deploying ? <CircularProgress size={20} color="inherit" /> : continueMessage}
                  </Button>
                </div>
              </form>
              {deployError ? (
                <DeployErrorMessage
                  message={deployError}
                  titleText={t('setup.deploy_error_title')}
                  descriptionText={t('setup.deploy_error_description')}
                />
              ) : null}
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
