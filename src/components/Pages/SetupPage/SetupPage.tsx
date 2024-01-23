import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createFetchComponent } from '@well-known-components/fetch-component'
import classNames from 'classnames'
import { createContentClient, DeploymentBuilder } from 'dcl-catalyst-client'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { EntityType } from '@dcl/schemas'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Checkbox } from 'decentraland-ui/dist/components/Checkbox/Checkbox'
import { Field } from 'decentraland-ui/dist/components/Field/Field'
import { WearablePreview } from 'decentraland-ui/dist/components/WearablePreview/WearablePreview'
import { connection } from 'decentraland-connect'
import { InputOnChangeData } from 'decentraland-ui'
import backImg from '../../../assets/images/back.svg'
import diceImg from '../../../assets/images/dice.svg'
import logoImg from '../../../assets/images/logo.svg'
import platformImg from '../../../assets/images/Platform.webp'
import { config } from '../../../modules/config'
import { fetchProfile } from '../../../modules/profile'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { subscribeToNewsletter } from './utils'
import styles from './SetupPage.module.css'

enum View {
  RANDOMIZE,
  FORM
}

function getRandomDefaultProfile() {
  return 'default' + (Math.floor(Math.random() * (160 - 1 + 1)) + 1)
}

export const SetupPage = () => {
  const [view, setView] = useState(View.RANDOMIZE)
  const [profile, setProfile] = useState(getRandomDefaultProfile())
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)
  const [nameError, setNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [agreeError, setAgreeError] = useState('')
  const [showErrors, setShowErrors] = useState(false)

  const accountRef = useRef<string>()
  const identityRef = useRef<AuthIdentity>()

  const { initialized, flags } = useContext(FeatureFlagsContext)

  const onRandomize = useCallback(() => setProfile(getRandomDefaultProfile()), [])
  const onContinue = useCallback(() => setView(View.FORM), [])
  const onBack = useCallback(() => setView(View.RANDOMIZE), [])
  const onNameChange = useCallback((_e: any, data: InputOnChangeData) => setName(data.value), [])
  const onEmailChange = useCallback((_e: any, data: InputOnChangeData) => setEmail(data.value), [])
  const onAgreeChange = useCallback(() => setAgree(!agree), [agree])

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()

      setShowErrors(true)

      if (nameError || emailError || agreeError) {
        return
      }

      // Create the content client to fetch and deploy profiles.
      const peerUrl = config.get('PEER_URL', '')
      const client = createContentClient({ url: peerUrl + '/content', fetcher: createFetchComponent() })

      // Fetch the entity of the currently selected default profile.
      const defaultEntity = (await client.fetchEntitiesByPointers([profile]))[0]
      console.log(defaultEntity)

      // Download the content of the default profile and create the files map to be used for deploying the new profile.
      const bodyName = 'body.png'
      const faceName = 'face256.png'

      const bodyBuffer = await client.downloadContent(defaultEntity.content.find(x => x.file === bodyName)!.hash)
      const faceBuffer = await client.downloadContent(defaultEntity.content.find(x => x.file === faceName)!.hash)

      const files = new Map<string, Uint8Array>()

      files.set(bodyName, bodyBuffer)
      files.set(faceName, faceBuffer)

      // Default profiles come with legacy ids for wearables, they need to be updated to urns before deploying.
      const mapLegacyIdToUrn = (urn: string) => urn.replace('dcl://base-avatars/', 'urn:decentraland:off-chain:base-avatars:')

      // Override the default avatar with the form data and the currently connected account.
      const avatar = defaultEntity.metadata.avatars[0]

      avatar.ethAddress = accountRef.current!
      avatar.name = name
      avatar.avatar.bodyShape = mapLegacyIdToUrn(defaultEntity.metadata.avatars[0].avatar.bodyShape)
      avatar.avatar.wearables = defaultEntity.metadata.avatars[0].avatar.wearables.map(mapLegacyIdToUrn)
      avatar.avatar.version = 1

      const deploymentEntity = await DeploymentBuilder.buildEntity({
        type: EntityType.PROFILE,
        pointers: [accountRef.current!],
        metadata: { avatars: [avatar] },
        timestamp: Date.now(),
        files
      })

      // Deploy the profile for the currently connected account.
      await client.deploy({
        entityId: deploymentEntity.entityId,
        files: deploymentEntity.files,
        authChain: Authenticator.signPayload(identityRef.current!, deploymentEntity.entityId)
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

      // TODO: Redirect to wherever the user was trying to go.
    },
    [nameError, emailError, agreeError, name, email, agree, profile]
  )

  // Validation effect.
  // Will perform some validations on the form data whenever input changes.
  useEffect(() => {
    // Validate the name.
    if (!name.length) {
      setNameError('Please enter your name.')
    } else if (name.length >= 15) {
      setNameError('Name can have a maximum of 15 characters.')
    } else if (!/^[a-zA-Z0-9]+$/.test(name)) {
      setNameError('Name can only contain letters and numbers.')
    } else {
      setNameError('')
    }

    // Validate the email.
    if (email && !email.includes('@')) {
      setEmailError('Please enter a valid email.')
    } else {
      setEmailError('')
    }

    // Validate the agree checkbox.
    if (!agree) {
      setAgreeError('Please accept the terms of use and privacy policy.')
    } else {
      setAgreeError('')
    }
  }, [name, email, agree])

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
        toLogin()
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
    })()
  }, [])

  if (!initialized) {
    return null
  }

  if (!flags[FeatureFlagsKeys.SIMPLIFIED_AVATAR_SETUP]) {
    window.location.href = '/'
    return null
  }

  if (view === View.RANDOMIZE) {
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
              <Button compact inverted onClick={onRandomize}>
                <img src={diceImg} alt="diceImg" />
                <span>randomize</span>
              </Button>
            </div>
            <div className={styles.continue}>
              <Button primary fluid onClick={onContinue}>
                continue
              </Button>
            </div>
          </div>
        </div>
        <div className={styles.right}>
          <WearablePreview lockBeta={true} panning={false} disableBackground={true} profile={profile} dev={false} />
          <img className={styles.platform} src={platformImg} alt="platform" />
        </div>
      </div>
    )
  }

  if (view === View.FORM) {
    return (
      <div className={styles.container}>
        <div className={styles.background} />
        <div className={styles.left}>
          <div className={styles.leftInner}>
            <img className={styles.logoSmall} src={logoImg} alt="logo" />
            <div className={styles.back} onClick={onBack}>
              <img src={backImg} alt="backImg" />
              <span>BACK</span>
            </div>
            <div className={styles.title}>Complete your Profile</div>
            <form onSubmit={onSubmit}>
              <div className={styles.name}>
                <Field
                  label="Name"
                  placeholder="Enter your name"
                  onChange={onNameChange}
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
                      <span>
                        Subscribe to Decentraland's newsletter to receive the latest news about events, updates, contests and more.
                      </span>
                    </>
                  }
                  onChange={onEmailChange}
                />
              </div>
              <div className={styles.agree}>
                <Checkbox onChange={onAgreeChange} />
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
                <Button primary fluid type="submit" disabled={!agree}>
                  Jump in decentraland
                </Button>
              </div>
            </form>
          </div>
        </div>
        <div className={styles.right}>
          <WearablePreview lockBeta={true} panning={false} disableBackground={true} profile={profile} dev={false} />
          <img className={styles.platform} src={platformImg} alt="platform" />
        </div>
      </div>
    )
  }

  return null
}

// offsetY={0.3}  cameraY={0.5} offsetZ={-1.5}
