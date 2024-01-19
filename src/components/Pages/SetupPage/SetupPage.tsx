import { useCallback, useContext, useEffect, useState } from 'react'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import logoImg from '../../../assets/images/logo.svg'
import styles from './SetupPage.module.css'
import { Field } from 'decentraland-ui/dist/components/Field/Field'
import { Checkbox } from 'decentraland-ui/dist/components/Checkbox/Checkbox'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { InputOnChangeData } from 'decentraland-ui'

export const SetupPage = () => {
  const { initialized, flags } = useContext(FeatureFlagsContext)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)

  const [nameError, setNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [agreeError, setAgreeError] = useState('')

  const [showErrors, setShowErrors] = useState(false)

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

  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <div className={styles.leftInner}>
          <img className={styles.logo} src={logoImg} alt="logo" />
          <div className={styles.title}>Create Your Digital Persona.</div>
          <div className={styles.subtitle}>Begin your journey.</div>
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
                    <span>Subscribe to Decentraland's newsletter to receive the latest news about events, updates, contests and more.</span>
                  </>
                }
                onChange={onEmailChange}
              />
            </div>
            <div className={styles.agree}>
              <Checkbox className={styles.checkbox} onChange={onAgreeChange} />
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
