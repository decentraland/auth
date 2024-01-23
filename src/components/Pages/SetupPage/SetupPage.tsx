import { useCallback, useContext, useEffect, useState } from 'react'
import { createFetchComponent } from '@well-known-components/fetch-component'
import classNames from 'classnames'
import { createContentClient, DeploymentBuilder } from 'dcl-catalyst-client'
import { Authenticator } from '@dcl/crypto'
import { Avatar, EntityType, Profile } from '@dcl/schemas'
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
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
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

  const { initialized, flags } = useContext(FeatureFlagsContext)

  const onRandomize = useCallback(() => setProfile(getRandomDefaultProfile()), [])
  const onContinue = useCallback(() => setView(View.FORM), [])
  const onBack = useCallback(() => setView(View.RANDOMIZE), [])
  const onNameChange = useCallback((_e: any, data: InputOnChangeData) => setName(data.value), [])
  const onEmailChange = useCallback((_e: any, data: InputOnChangeData) => setEmail(data.value), [])
  const onAgreeChange = useCallback(() => setAgree(!agree), [agree])

  const onSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    setShowErrors(true)

    if (nameError || emailError || agreeError) {
      return
    }

    // Try to restore connection so the connection lib can use the provider.
    // This view should be visible only after the user has already connected.
    // This is just a temporary workaround for development.
    await connection.tryPreviousConnection()

    // Get the address of the currently connected account.
    const provider = await connection.getProvider()
    const account = ((await provider.request({ method: 'eth_accounts' })) as string[])[0]

    // Create the content client to fetch and deploy profiles.
    const peerUrl = config.get('PEER_URL', '')
    const client = createContentClient({ url: peerUrl + '/content', fetcher: createFetchComponent() })

    // Fetch the profile of the currently selected profile and extract the avatar.
    const defaultAvatar = ((await client.fetchEntitiesByPointers([profile]))[0].metadata as Profile).avatars[0]

    // Default profiles come with legacy ids for wearables, they need to be updated to urns before deploying.
    const mapLegacyIdToUrn = (urn: string) => urn.replace('dcl://base-avatars/', 'urn:decentraland:off-chain:base-avatars:')

    const deploymentAvatar: Avatar = {
      userId: account,
      ethAddress: account,
      email: '',
      version: 0,
      hasClaimedName: false,
      tutorialStep: 0,
      name,
      description: '',
      hasConnectedWeb3: true,
      avatar: {
        bodyShape: mapLegacyIdToUrn(defaultAvatar.avatar.bodyShape),
        wearables: defaultAvatar.avatar.wearables.map(mapLegacyIdToUrn),
        emotes: [],
        eyes: defaultAvatar.avatar.eyes,
        hair: defaultAvatar.avatar.hair,
        skin: defaultAvatar.avatar.skin,
        snapshots: defaultAvatar.avatar.snapshots
      }
    }

    const buildEntityParams: Parameters<(typeof DeploymentBuilder)['buildEntity']>[0] = {
      type: EntityType.PROFILE,
      pointers: [account],
      metadata: { avatars: [deploymentAvatar] }
    }

    const deploymentEntity = await DeploymentBuilder.buildEntity(buildEntityParams)
    const identity = localStorageGetIdentity(account)

    if (!identity) {
      throw new Error('Missing identity')
    }

    const authChain = Authenticator.signPayload(identity, deploymentEntity.entityId)

    // TODO: Fix deployment not working due to missing face256 and body.png.
    await client.deploy({
      entityId: deploymentEntity.entityId,
      files: deploymentEntity.files,
      authChain
    })

    // TODO: Redirect to wherever the user was trying to go.
  }, [])

  useEffect(() => {
    if (!name.length) {
      setNameError('Please enter your name.')
    } else if (name.length >= 15) {
      setNameError('Name can have a maximum of 15 characters.')
    } else if (!/^[a-zA-Z0-9]+$/.test(name)) {
      setNameError('Name can only contain letters and numbers.')
    } else {
      setNameError('')
    }

    if (email && !email.includes('@')) {
      setEmailError('Please enter a valid email.')
    } else {
      setEmailError('')
    }

    if (!agree) {
      setAgreeError('Please accept the terms of use and privacy policy.')
    } else {
      setAgreeError('')
    }
  }, [name, email, agree])

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
