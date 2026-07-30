import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import classNames from 'classnames'
import { useTranslation } from '@dcl/hooks'
import { EthAddress } from '@dcl/schemas'
import { Button, CircularProgress, useMobileMediaQuery } from 'decentraland-ui2'
import backImg from '../../../assets/images/back.svg'
import diceImg from '../../../assets/images/dice.svg'
import logoImg from '../../../assets/images/logo.svg'
import wrongImg from '../../../assets/images/wrong.svg'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useDisabledCatalysts } from '../../../hooks/useDisabledCatalysts'
import { useTrackReferral } from '../../../hooks/useTrackReferral'
import { ClickEvents } from '../../../modules/analytics/types'
import { fetchProfileWithStatus } from '../../../modules/profile'
import { useCurrentConnectionData } from '../../../shared/connection'
import { isEmailValid } from '../../../shared/email'
import { locations } from '../../../shared/locations'
import { getStoredEmail } from '../../../shared/onboarding/getStoredEmail'
import { trackCheckpoint } from '../../../shared/onboarding/trackCheckpoint'
import { isProfileComplete } from '../../../shared/profile'
import { handleError } from '../../../shared/utils/errorHandler'
import { CustomWearablePreview } from '../../CustomWearablePreview'
import { FeatureFlagsContext } from '../../FeatureFlagsProvider'
import { deployProfileFromDefault, subscribeToNewsletter } from './utils'
import styles from './SetupPage.module.css'

const MAX_CHARACTERS = 15

enum View {
  RANDOMIZE,
  FORM
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
  const hasTrackedReferral = useRef(false)
  const initializedAccountRef = useRef<string | null>(null)
  const [urlSearchParams] = useSearchParams()
  const { initialized: initializedFlags } = useContext(FeatureFlagsContext)
  const [initialized, setInitialized] = useState(false)
  const [view, setView] = useState(View.RANDOMIZE)
  const [profile, setProfile] = useState(getRandomDefaultProfile())
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)
  const isMobile = useMobileMediaQuery()
  const { url: redirectTo, redirect } = useAfterLoginRedirection()
  const { isLoading: isConnecting, account, identity } = useCurrentConnectionData()
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
  const disabledCatalysts = useDisabledCatalysts()

  // Validate the name.
  const nameError = useMemo(() => {
    if (!name.length) {
      return t('setup.validation.username_empty')
    }
    if (name.length > MAX_CHARACTERS) {
      return t('setup.validation.username_max_length')
    }

    if (name.includes(' ')) {
      return t('setup.validation.username_no_spaces')
    }

    if (!/^[a-zA-Z0-9]+$/.test(name)) {
      return t('setup.validation.username_no_special_chars')
    }

    return ''
  }, [name, t])

  // Validate the email.
  const emailError = useMemo(() => {
    if (email && !isEmailValid(email)) {
      return t('setup.validation.email_invalid')
    }

    return ''
  }, [email, t])

  // Validate the agree checkbox.
  const agreeError = useMemo(() => {
    if (!agree) {
      return t('setup.validation.agree_required')
    }

    return ''
  }, [agree, t])

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
          deploymentProfileName: name,
          disabledCatalysts
        })

        if (referrer && EthAddress.validate(referrer)) {
          try {
            await trackReferral(referrer, 'PATCH')
          } catch {
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

        trackCheckpoint({
          checkpointId: 3,
          action: 'completed',
          source: 'auth',
          userIdentifier: email || account.toLowerCase(),
          identifierType: email ? 'email' : 'wallet',
          email: email || undefined,
          wallet: account.toLowerCase()
        })

        // Hand control back to whatever started the flow. When that is a request page, the
        // preserved `flow=deeplink` param resumes the identity handoff there.
        redirect()
      } catch (e) {
        const errorMessage = handleError(e, 'Error deploying profile')
        setDeployError(errorMessage)
        setDeploying(false)
      }
    },
    [
      nameError,
      emailError,
      agreeError,
      name,
      email,
      agree,
      profile,
      referrer,
      redirect,
      trackClick,
      trackTermsOfServiceSuccess,
      account,
      identity,
      disabledCatalysts
    ]
  )

  // Initialization effect.
  // Will run some checks to see if the user can proceed with the simplified avatar setup flow.
  useEffect(() => {
    if (isConnecting || !initializedFlags) return

    if (!account || !identity) {
      console.warn('No previous connection found')
      navigate(locations.login(redirectTo))
      return
    }

    // Run the one-time initialization once per connected account: a dep identity change must not
    // re-fetch the profile, re-fire the CP3 "reached" checkpoint, or overwrite an email the user
    // is editing with the stored one.
    if (initializedAccountRef.current === account) return
    initializedAccountRef.current = account
    ;(async () => {
      // Check if the wallet is connected.
      const { profile, couldNotDetermine } = await fetchProfileWithStatus(account)

      // If we couldn't determine whether a profile exists (catalyst outage), bail out rather than
      // risk overwriting an existing profile with a default one — the whole point of this guard.
      if (couldNotDetermine) {
        console.warn('Could not determine whether a profile exists; skipping setup to avoid overwrite')
        return redirect()
      }

      // Check that the connected account does not have a profile already.
      if (profile && isProfileComplete(profile)) {
        console.warn('Profile already exists')
        return redirect()
      }

      // Try to get stored email from web2 auth (Magic or Thirdweb)
      const storedEmail = getStoredEmail()
      if (storedEmail) {
        setEmail(storedEmail)
      }

      trackCheckpoint({
        checkpointId: 3,
        action: 'reached',
        source: 'auth',
        userIdentifier: storedEmail || account.toLowerCase(),
        identifierType: storedEmail ? 'email' : 'wallet',
        email: storedEmail || undefined,
        wallet: account.toLowerCase()
      })

      if (referrer && EthAddress.validate(referrer) && !hasTrackedReferral.current) {
        try {
          await trackReferral(referrer, 'POST')
          hasTrackedReferral.current = true
        } catch {
          // Error is already handled in trackReferral
        }
      }

      setInitialized(true)
    })()
  }, [redirect, navigate, account, identity, isConnecting, initializedFlags, referrer])

  if (!initialized) {
    return (
      <div className={styles.container}>
        <div className={styles.background} />
        <CircularProgress size={60} />
      </div>
    )
  }

  switch (view) {
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
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleRandomize}
                    className={styles.randomizeButton}
                    data-testid="setup-randomize-button"
                  >
                    <img src={diceImg} alt="diceImg" />
                    <span>{t('setup.randomize')}</span>
                  </Button>
                </div>
                <div className={styles.continue}>
                  <Button
                    variant="contained"
                    size={isMobile ? 'small' : 'medium'}
                    fullWidth={!isMobile}
                    onClick={handleContinue}
                    data-testid="setup-continue-button"
                  >
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
                  <Button variant="contained" fullWidth type="submit" disabled={!agree || deploying} data-testid="setup-submit-button">
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
