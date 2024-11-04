import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import { AuthIdentity } from '@dcl/crypto'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Checkbox } from 'decentraland-ui/dist/components/Checkbox/Checkbox'
import { Field } from 'decentraland-ui/dist/components/Field/Field'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { Mobile, NotMobile } from 'decentraland-ui/dist/components/Media/Media'
import { InputOnChangeData } from 'decentraland-ui'
import backImg from '../../../assets/images/back.svg'
import diceImg from '../../../assets/images/dice.svg'
import logoImg from '../../../assets/images/logo.svg'
import wrongImg from '../../../assets/images/wrong.svg'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { getAnalytics } from '../../../modules/analytics/segment'
import { ClickEvents, TrackingEvents } from '../../../modules/analytics/types'
import { fetchProfile } from '../../../modules/profile'
import { getCurrentConnectionData } from '../../../shared/connection'
import { locations } from '../../../shared/locations'
import { CustomWearablePreview } from '../../CustomWearablePreview'
import { FeatureFlagsContext } from '../../FeatureFlagsProvider'
import { deployProfileFromDefault, subscribeToNewsletter } from './utils'
import styles from './SetupPage.module.css'

enum View {
  RANDOMIZE,
  FORM
}

function getRandomDefaultProfile() {
  return 'default' + (Math.floor(Math.random() * (160 - 1 + 1)) + 1)
}

const ErrorMessage = (props: { message: string; className?: string }) => {
  return (
    <div className={classNames(styles.error, props.className)}>
      <img src={wrongImg} />
      <div>{props.message}</div>
    </div>
  )
}

export const SetupPage = () => {
  const navigate = useNavigateWithSearchParams()
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

  const { initialized: initializedFlags } = useContext(FeatureFlagsContext)

  const { url: redirectTo, redirect } = useAfterLoginRedirection()

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
        redirect()
      } catch (e) {
        setDeploying(false)

        // TODO: Display a proper error on the page to show the user.
        console.error('There was an error deploying the profile', (e as Error).message)
      }
    },
    [nameError, emailError, agreeError, name, email, agree, profile, redirect]
  )

  // Initialization effect.
  // Will run some checks to see if the user can proceed with the simplified avatar setup flow.
  useEffect(() => {
    ;(async () => {
      // Check if the wallet is connected.
      try {
        const connectionData = await getCurrentConnectionData()
        if (!connectionData) {
          throw new Error('No connection data found')
        }
        accountRef.current = connectionData.account
        identityRef.current = connectionData.identity
      } catch (e) {
        console.warn('No previous connection found')
        return navigate(locations.login())
      }

      const profile = await fetchProfile(accountRef.current)

      // Check that the connected account does not have a profile already.
      if (profile) {
        console.warn('Profile already exists')
        return redirect()
      }

      setInitialized(true)
    })()
  }, [redirect, navigate])

  if (!initialized || !initializedFlags) {
    return (
      <div className={styles.container}>
        <div className={styles.background} />
        <Loader active size="huge" />
      </div>
    )
  }

  if (view === View.RANDOMIZE) {
    return (
      <>
        <Mobile>
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
                <CustomWearablePreview profile={profile} />
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
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Mobile>
        <NotMobile>
          <div className={styles.container}>
            <div className={styles.background} />
            <div className={styles.left}>
              <div className={styles.leftInner}>
                <img className={styles.logo} src={logoImg} alt="logo" />
                <div className={styles.title}>Welcome to Decentraland!</div>
                <div className={styles.subtitle}>Your journey begins here</div>
                <div className={styles.meetYourAvatar}>First, Meet Your Avatar</div>
                <div className={styles.meetYourAvatarDescription}>
                  Say hi to your new digital self!
                  <br />
                  Don't worry, of course they're not quite 'you' yet—soon you'll be able to customize them to your heart's content.
                </div>
                <div className={styles.randomize}>
                  <Button compact inverted onClick={handleRandomize}>
                    <img src={diceImg} alt="diceImg" />
                    <span>randomize</span>
                  </Button>
                </div>
                <div className={styles.continue}>
                  <Button primary fluid onClick={handleContinue}>
                    Continue
                  </Button>
                </div>
              </div>
            </div>
            <div className={styles.right}>
              <CustomWearablePreview profile={profile} />
            </div>
          </div>
        </NotMobile>
      </>
    )
  }

  return (
    <>
      <Mobile>
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
                  label="Username"
                  placeholder="Enter your Username"
                  onChange={handleNameChange}
                  message={showErrors && nameError ? <ErrorMessage message={nameError} /> : undefined}
                />
              </div>
              <div>
                <Field
                  label="Email (optional)"
                  placeholder="Enter your email"
                  message={
                    <>
                      {showErrors && emailError ? <ErrorMessage className={styles.emailError} message={emailError} /> : null}
                      <span>
                        Subscribe to Decentraland's newsletter to receive the latest news about events, updates, contests and more.
                      </span>
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
                  .
                </div>
              </div>
              {showErrors && agreeError ? <ErrorMessage className={styles.agreeError} message={agreeError} /> : null}
              <div className={styles.jumpIn}>
                <Button primary fluid type="submit" disabled={!agree || deploying} loading={deploying}>
                  {continueMessage}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Mobile>
      <NotMobile>
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
                    label="Username"
                    placeholder="Enter your username"
                    onChange={handleNameChange}
                    message={showErrors && nameError ? <ErrorMessage message={nameError} /> : undefined}
                  />
                </div>
                <div>
                  <Field
                    label="Email (optional)"
                    placeholder="Enter your email"
                    message={
                      <>
                        {showErrors && emailError ? <ErrorMessage className={styles.emailError} message={emailError} /> : null}
                        <span>
                          Subscribe to Decentraland's newsletter to receive the latest news about events, updates, contests and more.
                        </span>
                      </>
                    }
                    onChange={handleEmailChange}
                  />
                </div>
                <div className={styles.agree}>
                  <Checkbox onChange={handleAgreeChange} />I agree with Decentraland's&nbsp;
                  <a target="_blank" rel="noopener noreferrer" href="https://decentraland.org/terms/">
                    Terms of use
                  </a>
                  &nbsp;and&nbsp;
                  <a target="_blank" rel="noopener noreferrer" href="https://decentraland.org/privacy">
                    Privacy policy
                  </a>
                  .
                </div>
                {showErrors && agreeError ? <ErrorMessage className={styles.agreeError} message={agreeError} /> : null}
                <div className={styles.jumpIn}>
                  <Button primary fluid type="submit" disabled={!agree || deploying} loading={deploying}>
                    {continueMessage}
                  </Button>
                </div>
              </form>
            </div>
          </div>
          <div className={styles.right}>
            <CustomWearablePreview profile={profile} />
          </div>
        </div>
      </NotMobile>
    </>
  )
}
