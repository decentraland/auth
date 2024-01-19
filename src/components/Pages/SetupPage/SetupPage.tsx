import { useCallback, useContext, useEffect, useState } from 'react'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Checkbox } from 'decentraland-ui/dist/components/Checkbox/Checkbox'
import { Field } from 'decentraland-ui/dist/components/Field/Field'
import { InputOnChangeData } from 'decentraland-ui'
import backImg from '../../../assets/images/back.svg'
import diceImg from '../../../assets/images/dice.svg'
import logoImg from '../../../assets/images/logo.svg'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import styles from './SetupPage.module.css'

enum View {
  RANDOMIZE,
  FORM
}

export const SetupPage = () => {
  const [view, setView] = useState(View.RANDOMIZE)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)
  const [nameError, setNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [agreeError, setAgreeError] = useState('')
  const [showErrors, setShowErrors] = useState(false)

  const { initialized, flags } = useContext(FeatureFlagsContext)

  const onContinue = useCallback(() => setView(View.FORM), [])
  const onBack = useCallback(() => setView(View.RANDOMIZE), [])
  const onNameChange = useCallback((_e: any, data: InputOnChangeData) => setName(data.value), [])
  const onEmailChange = useCallback((_e: any, data: InputOnChangeData) => setEmail(data.value), [])
  const onAgreeChange = useCallback(() => setAgree(!agree), [agree])

  const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    setShowErrors(true)

    if (nameError || emailError || agreeError) {
      return
    }

    // TODO: Handle submit.
    console.log('submit')
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
              <Button compact inverted>
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
        <div className={styles.right}></div>
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
                  message={showErrors ? <span className={styles.nameError}>{nameError}</span> : undefined}
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
                          <span className={styles.emailError}>{emailError}</span>
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
              {showErrors && agreeError ? <div className={styles.agreeError}>{agreeError}</div> : null}
              <div className={styles.jumpIn}>
                <Button primary fluid type="submit">
                  Jump in decentraland
                </Button>
              </div>
            </form>
          </div>
        </div>
        <div className={styles.right}></div>
      </div>
    )
  }

  return null
}
