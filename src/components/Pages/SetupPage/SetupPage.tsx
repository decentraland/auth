import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import { AuthIdentity } from '@dcl/crypto'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Checkbox } from 'decentraland-ui/dist/components/Checkbox/Checkbox'
import { Field } from 'decentraland-ui/dist/components/Field/Field'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { WearablePreview } from 'decentraland-ui/dist/components/WearablePreview/WearablePreview'
import { connection } from 'decentraland-connect'
import { InputOnChangeData } from 'decentraland-ui'
import backImg from '../../../assets/images/back.svg'
import diceImg from '../../../assets/images/dice.svg'
import logoImg from '../../../assets/images/logo.svg'
import platformImg from '../../../assets/images/Platform.webp'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { getAnalytics } from '../../../modules/analytics/segment'
import { ClickEvents, TrackingEvents } from '../../../modules/analytics/types'
import { fetchProfile } from '../../../modules/profile'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { deployProfileFromDefault, subscribeToNewsletter } from './utils'
import styles from './SetupPage.module.css'

enum View {
  RANDOMIZE,
  FORM
}

function getRandomDefaultProfile() {
  return 'default' + (Math.floor(Math.random() * (160 - 1 + 1)) + 1)
}

export const SetupPage = () => {
  const [initialized, setInitialized] = useState(false)
  const [view, setView] = useState(View.RANDOMIZE)
  const [profile, setProfile] = useState(getRandomDefaultProfile())
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [deploying, setDeploying] = useState(false)

  const accountRef = useRef<string>()
  const identityRef = useRef<AuthIdentity>()

  const { initialized: initializedFlags, flags } = useContext(FeatureFlagsContext)

  const redirectTo = useAfterLoginRedirection()

  const isMobile = useMemo(() => window.innerWidth <= 768, [])

  // Validate the name.
  const nameError = useMemo(() => {
    if (!name.length) {
      return 'Please enter your name.'
    }
    if (name.length >= 15) {
      return 'Name can have a maximum of 15 characters.'
    }

    if (!/^[a-zA-Z0-9]+$/.test(name)) {
      return 'Name can only contain letters and numbers.'
    }

    return ''
  }, [name])

  // Validate the email.
  const emailError = useMemo(() => {
    if (email && !email.includes('@')) {
      return 'Please enter a valid email.'
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

  // Sets a random default profile.
  const handleRandomize = useCallback(() => {
    getAnalytics().track(TrackingEvents.CLICK, {
      action: ClickEvents.RANDOMIZE
    })

    setProfile(getRandomDefaultProfile())
  }, [])

  // Confirms the current default profile and goes to the form view.
  const handleContinue = useCallback(() => {
    getAnalytics().track(TrackingEvents.AVATAR_EDIT_SUCCESS, {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      eth_address: accountRef.current,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      is_guest: false,
      profile
    })

    setView(View.FORM)
  }, [profile])

  // Goes back into the randomize view to select a new default profile.
  const handleBack = useCallback(() => {
    getAnalytics().track(TrackingEvents.CLICK, {
      action: ClickEvents.BACK_TO_AVATAR_RANDOMIZATION_VIEW
    })

    setView(View.RANDOMIZE)
  }, [])

  // Form input handlers.
  const handleNameChange = useCallback((_e: unknown, data: InputOnChangeData) => setName(data.value), [])
  const handleEmailChange = useCallback((_e: unknown, data: InputOnChangeData) => setEmail(data.value), [])
  const handleAgreeChange = useCallback(() => setAgree(!agree), [agree])

  // Handles the deployment of a new profile based on the selected default profile.
  // Also subscribes the user to the newsletter if an email is provided.
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()

      getAnalytics().track(TrackingEvents.CLICK, {
        action: ClickEvents.SUBMIT_PROFILE
      })

      setShowErrors(true)

      // If any of the fields has an error, don't submit.
      if (nameError || emailError || agreeError) {
        return
      }

      // These refs should have values at this point.
      // If they don't, it means that there was something wrong on the initialization effect.
      if (!accountRef.current || !identityRef.current) {
        console.warn('No account or identity found.')
        return
      }

      try {
        setDeploying(true)

        // Deploy a new profile for the user based on the selected default profile.
        await deployProfileFromDefault({
          connectedAccount: accountRef.current,
          connectedAccountIdentity: identityRef.current,
          defaultProfile: profile,
          deploymentProfileName: name
        })

        // Subscribe to the newsletter only if the user has provided an email.
        if (email) {
          // Given that the subscription is an extra step, we don't want to block the user if it fails.
          try {
            await subscribeToNewsletter(email)
          } catch (e) {
            console.warn('There was an error subscribing to the newsletter', (e as Error).message)
          }
        }

        getAnalytics().track(TrackingEvents.TERMS_OF_SERVICE_SUCCESS, {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          eth_address: accountRef.current,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          is_guest: false,
          email: email || undefined,
          name
        })

        // Redirect to the site defined in the search params.
        if (redirectTo) {
          window.location.href = decodeURIComponent(redirectTo)
        } else {
          window.location.href = '/'
        }
      } catch (e) {
        setDeploying(false)

        // TODO: Display a proper error on the page to show the user.
        console.error('There was an error deploying the profile', (e as Error).message)
      }
    },
    [nameError, emailError, agreeError, name, email, agree, profile, redirectTo]
  )

  // Initialization effect.
  // Will run some checks to see if the user can proceed with the simplified avatar setup flow.
  useEffect(() => {
    ;(async () => {
      const toLogin = () => {
        window.location.href = '/auth/login'
      }

      // Check if the wallet is connected.
      try {
        await connection.tryPreviousConnection()
      } catch (e) {
        console.warn('No previous connection found')
        toLogin()
        return
      }

      const provider = await connection.getProvider()
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[]

      // Check that there is at least one account connected.
      if (!accounts.length) {
        console.warn('No accounts found')
        toLogin()
        return
      }

      const account = accounts[0]

      accountRef.current = account

      const profile = await fetchProfile(account)

      // Check that the connected account does not have a profile already.
      if (profile) {
        console.warn('Profile already exists')

        if (redirectTo) {
          window.location.href = decodeURIComponent(redirectTo)
        } else {
          window.location.href = '/'
        }

        return
      }

      const identity = localStorageGetIdentity(account)

      // Check that the connected account has an identity.
      if (!identity) {
        console.warn('No identity found for the connected account')
        toLogin()
        return
      }

      identityRef.current = identity

      setInitialized(true)
    })()
  }, [redirectTo])

  if (!initialized || !initializedFlags) {
    return (
      <div className={styles.container}>
        <div className={styles.background} />
        <Loader active size="huge" />
      </div>
    )
  }

  if (!flags[FeatureFlagsKeys.SIMPLIFIED_AVATAR_SETUP]) {
    window.location.href = '/'
    return null
  }

  if (view === View.RANDOMIZE) {
    if (isMobile) {
      return (
        <div className={styles.container}>
          <div className={styles.background} />
          <div className={styles.mobileContainer}>
            <img className={styles.logo} src={logoImg} alt="logo" />
            <div className={styles.title}>Welcome to Decentraland!</div>
            <div className={styles.meetYourAvatar}>First, Meet Your Avatar</div>
            <div className={styles.meetYourAvatarDescription}>
              Choose an avatar to start your journey.
              <br />
              <b>You can customize it later on desktop</b>, where all the magic happens!
            </div>
            <div className={styles.mobilePreviewContainer}>
              <WearablePreview lockBeta={true} panning={false} disableBackground={true} profile={profile} dev={false} />
              <Loader active />
              <img className={styles.platform} src={platformImg} alt="platform" />
            </div>
            <div className={styles.mobileButtons}>
              <div className={styles.randomize}>
                <Button compact inverted onClick={handleRandomize}>
                  <img src={diceImg} alt="diceImg" />
                  <span>randomize</span>
                </Button>
              </div>
              <div className={styles.continue}>
                <Button compact primary onClick={handleContinue}>
                  continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className={styles.container}>
        <div className={styles.background} />
        <div className={styles.left}>
          <div className={styles.leftInner}>
            <img className={styles.logo} src={logoImg} alt="logo" />
            <div className={styles.title}>Welcome to Decentraland!</div>
            <div className={styles.subtitle}>Your journey begins here</div>
            <div className={styles.meetYourAvatar}>First, Meet Your Avatar</div>
            <div className={styles.meetYourAvatarDescription}>
              This is your new digital self!
              <br />
              Don't worry if it's not quite 'you' yet - you'll later have plenty of options to make it your own.
            </div>
            <div className={styles.randomize}>
              <Button compact inverted onClick={handleRandomize}>
                <img src={diceImg} alt="diceImg" />
                <span>randomize</span>
              </Button>
            </div>
            <div className={styles.continue}>
              <Button primary fluid onClick={handleContinue}>
                continue
              </Button>
            </div>
          </div>
        </div>
        <div className={styles.right}>
          <WearablePreview lockBeta={true} panning={false} disableBackground={true} profile={profile} dev={false} />
          <Loader active size="huge" />
          <img className={styles.platform} src={platformImg} alt="platform" />
        </div>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className={styles.container}>
        <div className={styles.background} />
        <div className={styles.mobileContainer}>
          <div className={styles.back} onClick={handleBack}>
            <img src={backImg} alt="backImg" />
            <span>BACK</span>
          </div>
          <div className={classNames(styles.title, styles.mobileCompleteYourProfile)}>Complete your Profile</div>
          <form onSubmit={handleSubmit}>
            <div className={styles.name}>
              <Field
                label="Name"
                placeholder="Enter your name"
                onChange={handleNameChange}
                message={showErrors ? <span className={classNames(styles.error, styles.nameError)}>{nameError}</span> : undefined}
              />
            </div>
            <div className={styles.email}>
              <Field
                label="Email (optional)"
                placeholder="Enter your email"
                message={
                  <>
                    {showErrors && emailError ? (
                      <>
                        <span className={classNames(styles.error, styles.emailError)}>{emailError}</span>
                        <br />
                      </>
                    ) : null}
                    <span>Subscribe to Decentraland's newsletter to receive the latest news about events, updates, contests and more.</span>
                  </>
                }
                onChange={handleEmailChange}
              />
            </div>
            <div className={styles.agree}>
              <Checkbox onChange={handleAgreeChange} />
              <div>
                I agree with Decentraland's&nbsp;
                <a target="_blank" rel="noopener noreferrer" href="https://decentraland.org/terms/">
                  Terms of use
                </a>
                &nbsp;and&nbsp;
                <a target="_blank" rel="noopener noreferrer" href="https://decentraland.org/privacy">
                  Privacy policy
                </a>
              </div>
            </div>
            {showErrors && agreeError ? <div className={classNames(styles.error, styles.agreeError)}>{agreeError}</div> : null}
            <div className={styles.jumpIn}>
              <Button primary fluid type="submit" disabled={!agree || deploying} loading={deploying}>
                Continue
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.background} />
      <div className={styles.left}>
        <div className={styles.leftInner}>
          <img className={styles.logoSmall} src={logoImg} alt="logo" />
          <div className={styles.back} onClick={handleBack}>
            <img src={backImg} alt="backImg" />
            <span>BACK</span>
          </div>
          <div className={styles.title}>Complete your Profile</div>
          <form onSubmit={handleSubmit}>
            <div className={styles.name}>
              <Field
                label="Name"
                placeholder="Enter your name"
                onChange={handleNameChange}
                message={showErrors ? <span className={classNames(styles.error, styles.nameError)}>{nameError}</span> : undefined}
              />
            </div>
            <div className={styles.email}>
              <Field
                label="Email (optional)"
                placeholder="Enter your email"
                message={
                  <>
                    {showErrors && emailError ? (
                      <>
                        <span className={classNames(styles.error, styles.emailError)}>{emailError}</span>
                        <br />
                      </>
                    ) : null}
                    <span>Subscribe to Decentraland's newsletter to receive the latest news about events, updates, contests and more.</span>
                  </>
                }
                onChange={handleEmailChange}
              />
            </div>
            <div className={styles.agree}>
              <Checkbox onChange={handleAgreeChange} />
              &nbsp;I agree with Decentraland's&nbsp;
              <a target="_blank" rel="noopener noreferrer" href="https://decentraland.org/terms/">
                Terms of use
              </a>
              &nbsp;and&nbsp;
              <a target="_blank" rel="noopener noreferrer" href="https://decentraland.org/privacy">
                Privacy policy
              </a>
            </div>
            {showErrors && agreeError ? <div className={classNames(styles.error, styles.agreeError)}>{agreeError}</div> : null}
            <div className={styles.jumpIn}>
              <Button primary fluid type="submit" disabled={!agree || deploying} loading={deploying}>
                Continue
              </Button>
            </div>
          </form>
        </div>
      </div>
      <div className={styles.right}>
        <WearablePreview lockBeta={true} panning={false} disableBackground={true} profile={profile} dev={false} />
        <Loader active size="huge" />
        <img className={styles.platform} src={platformImg} alt="platform" />
      </div>
    </div>
  )
}
