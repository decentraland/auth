import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '@dcl/hooks'
import { EthAddress } from '@dcl/schemas'
import { CircularProgress, useMobileMediaQuery } from 'decentraland-ui2'
import bodyTypeIconWomanSvg from '../../../assets/images/body-type-icon-woman.svg'
import bodyTypeIconManSvg from '../../../assets/images/body-type-icon.svg'
import randomizeIconSvg from '../../../assets/images/randomize-icon.svg'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useDisabledCatalysts } from '../../../hooks/useDisabledCatalysts'
import { useTrackReferral } from '../../../hooks/useTrackReferral'
import { fetchProfileWithStatus } from '../../../modules/profile'
import { useCurrentConnectionData } from '../../../shared/connection'
import { locations } from '../../../shared/locations'
import { getStoredEmail } from '../../../shared/onboarding/getStoredEmail'
import { trackCheckpoint } from '../../../shared/onboarding/trackCheckpoint'
import { isProfileComplete } from '../../../shared/profile'
import { handleError } from '../../../shared/utils/errorHandler'
import { AnimatedBackground } from '../../AnimatedBackground'
import { CustomWearablePreview } from '../../CustomWearablePreview'
import { deployProfileFromDefault, subscribeToNewsletter } from '../SetupPage/utils'
import { getCelebrateAnimation, prefetchCelebrateAnimation } from './celebratePrefetch'
import {
  AvatarWrapper,
  BackgroundShadow,
  BodyTypeButton,
  BodyTypeChevron,
  BodyTypeDropdown,
  BodyTypeDropdownItem,
  CelebrateAnimation,
  CelebrationBackground,
  CelebrationOverlay,
  CelebrationTitle,
  CharCount,
  CheckboxInput,
  CheckboxRow,
  ContentWrapper,
  EmailHelperText,
  GradientText,
  InputLabel,
  LeftSection,
  LinkText,
  PageContainer,
  RandomizeBar,
  RandomizeButton,
  RandomizeIcon,
  RightSection,
  StyledLogo,
  SubText,
  SubmitButton,
  SuccessButton,
  UsernameInput,
  WelcomeTitle
} from './QuickSetupPage.styled'

const MAX_NAME_LENGTH = 15

type BodyType = 'A' | 'B'

// Catalyst convention: defaults 1-80 are BaseFemale, defaults 81-160 are BaseMale.
// Body Type A is displayed with the man icon and Body Type B with the woman icon,
// so A maps to the Male range and B to the Female range.
function getRandomDefaultProfile(bodyType: BodyType) {
  if (bodyType === 'A') {
    return 'default' + (Math.floor(Math.random() * 80) + 81)
  }
  return 'default' + (Math.floor(Math.random() * 80) + 1)
}

export const QuickSetupPage = () => {
  const { t } = useTranslation()
  const { url: redirectTo, redirect } = useAfterLoginRedirection()
  const { account, identity, isLoading: isConnecting } = useCurrentConnectionData()
  const navigate = useNavigateWithSearchParams()
  const isMobile = useMobileMediaQuery()
  const [urlSearchParams] = useSearchParams()
  const referrer = urlSearchParams.get('referrer')
  const { track: trackReferral } = useTrackReferral()
  const hasTrackedReferral = useRef(false)
  const initializedAccountRef = useRef<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  const [inheritedEmail] = useState<string | null>(() => getStoredEmail())
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(false)
  const [agree, setAgree] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [bodyType, setBodyType] = useState<BodyType>('A')
  const [profile, setProfile] = useState(() => getRandomDefaultProfile('A'))
  const [showCelebration, setShowCelebration] = useState(false)
  const [bodyTypeOpen, setBodyTypeOpen] = useState(false)
  const [celebrationAnimData, setCelebrationAnimData] = useState<unknown>(null)
  const bodyTypeRef = useRef<HTMLDivElement>(null)

  // Start downloading the 16 MB Lottie animation as soon as the page mounts.
  // By the time the user fills in the form and submits, it should be cached.
  useEffect(() => {
    prefetchCelebrateAnimation()
  }, [])

  // Close body type dropdown on click outside
  useEffect(() => {
    if (!bodyTypeOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (bodyTypeRef.current && !bodyTypeRef.current.contains(e.target as Node)) {
        setBodyTypeOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [bodyTypeOpen])

  const disabledCatalysts = useDisabledCatalysts()

  // This route is otherwise unguarded. Mirror the SetupPage/AvatarSetupPage guards: send a
  // disconnected user to login and — critically — bail out for a user who ALREADY has a complete
  // profile so we never overwrite it with a default one. Also emit the CP3 "reached" checkpoint and
  // track the referral (POST) like the sibling flows. Runs once per connected account.
  useEffect(() => {
    if (isConnecting) return

    if (!account || !identity) {
      console.warn('No previous connection found')
      navigate(locations.login(redirectTo, referrer))
      return
    }

    if (initializedAccountRef.current === account) return
    initializedAccountRef.current = account
    ;(async () => {
      const { profile, couldNotDetermine } = await fetchProfileWithStatus(account)

      // If we couldn't determine whether a profile exists (catalyst outage), bail out rather than
      // risk overwriting an existing profile with a default one — the whole point of this guard.
      if (couldNotDetermine) {
        console.warn('Could not determine whether a profile exists; skipping setup to avoid overwrite')
        return redirect()
      }

      if (profile && isProfileComplete(profile)) {
        console.warn('Profile already exists')
        return redirect()
      }

      trackCheckpoint({
        checkpointId: 3,
        action: 'reached',
        source: 'auth',
        userIdentifier: inheritedEmail || account.toLowerCase(),
        identifierType: inheritedEmail ? 'email' : 'wallet',
        email: inheritedEmail || undefined,
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
  }, [account, identity, isConnecting, navigate, redirect, redirectTo, referrer, trackReferral, inheritedEmail])

  // Enforce the alphanumeric charset rule the other flows use (SetupPage uses /^[a-zA-Z0-9]+$/), in
  // addition to the existing length limit. Empty names are handled by the non-empty check in canSubmit.
  const isNameValid = /^[a-zA-Z0-9]+$/.test(name)
  const nameError = name.length > MAX_NAME_LENGTH || (name.length > 0 && !isNameValid)
  const canSubmit = name.trim().length > 0 && agree && !nameError && !deploying

  const handleRandomize = useCallback(() => {
    setProfile(getRandomDefaultProfile(bodyType))
  }, [bodyType])

  const handleSelectBodyType = useCallback((type: BodyType) => {
    setBodyType(type)
    setProfile(getRandomDefaultProfile(type))
    setBodyTypeOpen(false)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!canSubmit || !account || !identity) return

      try {
        setDeploying(true)
        setDeployError(null)

        await deployProfileFromDefault({
          connectedAccount: account,
          connectedAccountIdentity: identity,
          defaultProfile: profile,
          deploymentProfileName: name.trim(),
          disabledCatalysts
        })

        if (referrer && EthAddress.validate(referrer)) {
          try {
            await trackReferral(referrer, 'PATCH')
          } catch {
            // Error is already handled in trackReferral
          }
        }

        let newsletterEmail = ''
        if (inheritedEmail && subscribeNewsletter) {
          newsletterEmail = inheritedEmail
        } else if (!inheritedEmail) {
          newsletterEmail = email.trim()
        }
        if (newsletterEmail) {
          try {
            await subscribeToNewsletter(newsletterEmail)
          } catch (err) {
            handleError(err, 'Error subscribing to newsletter', { skipTracking: true })
          }
        }

        trackCheckpoint({
          checkpointId: 3,
          action: 'completed',
          source: 'auth',
          // Mirror the CP3 "reached" attribution above (and the sibling Setup/AvatarSetup pages):
          // key web2 users on their inherited email, not wallet-only, so the onboarding funnel can
          // correlate reached→completed instead of seeing "reached, never completed".
          userIdentifier: inheritedEmail || account.toLowerCase(),
          identifierType: inheritedEmail ? 'email' : 'wallet',
          email: inheritedEmail || undefined,
          wallet: account.toLowerCase()
        })

        setShowCelebration(true)
        getCelebrateAnimation()
          .then(setCelebrationAnimData)
          .catch(() => {
            // Animation failed to load — celebration screen still shows without it
          })
      } catch (err) {
        const errorMessage = handleError(err, 'Error deploying profile')
        setDeployError(errorMessage)
        setDeploying(false)
      }
    },
    [canSubmit, account, identity, profile, name, email, inheritedEmail, subscribeNewsletter, disabledCatalysts, referrer, trackReferral]
  )

  if (!initialized) {
    return (
      <PageContainer>
        <AnimatedBackground variant="absolute" />
        <CircularProgress size={60} />
      </PageContainer>
    )
  }

  if (showCelebration) {
    return (
      <PageContainer>
        <AnimatedBackground variant="absolute" />
        <CelebrationBackground />
        <CelebrationOverlay>
          <CelebrationTitle>{t('quick_setup.account_ready')}</CelebrationTitle>
          {celebrationAnimData ? <CelebrateAnimation animationData={celebrationAnimData} loop={false} /> : null}
          <SuccessButton variant="contained" onClick={() => redirect()}>
            {t('quick_setup.start_exploring')}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </SuccessButton>
        </CelebrationOverlay>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <AnimatedBackground variant="absolute" />
      <BackgroundShadow />
      <ContentWrapper>
        <LeftSection>
          <StyledLogo size="huge" />
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <WelcomeTitle>
              {t('quick_setup.welcome')} <GradientText>{t('quick_setup.decentraland')}</GradientText>
            </WelcomeTitle>

            <InputLabel>{t('quick_setup.username_label')}</InputLabel>
            <UsernameInput
              placeholder={t('quick_setup.username_placeholder')}
              value={name}
              onChange={e => setName(e.target.value)}
              inputProps={{ maxLength: MAX_NAME_LENGTH }}
              fullWidth
              error={nameError}
            />
            <CharCount>
              {name.length}/{MAX_NAME_LENGTH}
            </CharCount>

            {!inheritedEmail && (
              <>
                <InputLabel>{t('quick_setup.email_label')}</InputLabel>
                <UsernameInput
                  placeholder={t('quick_setup.email_placeholder')}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  fullWidth
                />
                <EmailHelperText>{t('quick_setup.email_helper')}</EmailHelperText>
              </>
            )}

            {inheritedEmail && (
              <CheckboxRow
                control={<CheckboxInput checked={subscribeNewsletter} onChange={(_, checked) => setSubscribeNewsletter(checked)} />}
                label={t('quick_setup.newsletter_subscribe')}
              />
            )}

            <CheckboxRow
              control={<CheckboxInput checked={agree} onChange={(_, checked) => setAgree(checked)} />}
              label={
                <span>
                  {t('quick_setup.agree_prefix')}{' '}
                  <LinkText href="https://decentraland.org/terms" target="_blank">
                    {t('quick_setup.terms_of_use')}
                  </LinkText>{' '}
                  {t('quick_setup.agree_connector')}{' '}
                  <LinkText href="https://decentraland.org/privacy" target="_blank">
                    {t('quick_setup.privacy_policy')}
                  </LinkText>
                  .*
                </span>
              }
            />

            {deployError && <SubText sx={{ color: 'error.main', mb: 2 }}>{deployError}</SubText>}

            <SubmitButton type="submit" variant="contained" disabled={!canSubmit}>
              {deploying ? t('quick_setup.deploying') : t('quick_setup.lets_go')}
            </SubmitButton>
          </form>
        </LeftSection>

        {!isMobile && (
          <RightSection>
            <AvatarWrapper>
              <CustomWearablePreview profile={profile} />
            </AvatarWrapper>
            <RandomizeBar>
              <div ref={bodyTypeRef} style={{ position: 'relative' }}>
                <BodyTypeButton onClick={() => setBodyTypeOpen(!bodyTypeOpen)}>
                  <img src={bodyType === 'A' ? bodyTypeIconManSvg : bodyTypeIconWomanSvg} alt="" width="24" height="24" />
                  {bodyType === 'A' ? t('quick_setup.body_type_a') : t('quick_setup.body_type_b')}
                  <BodyTypeChevron open={bodyTypeOpen}>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </BodyTypeChevron>
                </BodyTypeButton>
                {bodyTypeOpen && (
                  <BodyTypeDropdown>
                    <BodyTypeDropdownItem selected={bodyType === 'A'} onClick={() => handleSelectBodyType('A')}>
                      <img src={bodyTypeIconManSvg} alt="" width="24" height="24" />
                      {t('quick_setup.body_type_a')}
                      {bodyType === 'A' && (
                        <svg
                          width="13"
                          height="10"
                          viewBox="0 0 13 10"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          style={{ marginLeft: 'auto' }}
                        >
                          <path d="M1 5L4.5 8.5L12 1" stroke="#FF7439" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </BodyTypeDropdownItem>
                    <BodyTypeDropdownItem selected={bodyType === 'B'} onClick={() => handleSelectBodyType('B')}>
                      <img src={bodyTypeIconWomanSvg} alt="" width="24" height="24" />
                      {t('quick_setup.body_type_b')}
                      {bodyType === 'B' && (
                        <svg
                          width="13"
                          height="10"
                          viewBox="0 0 13 10"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          style={{ marginLeft: 'auto' }}
                        >
                          <path d="M1 5L4.5 8.5L12 1" stroke="#FF7439" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </BodyTypeDropdownItem>
                  </BodyTypeDropdown>
                )}
              </div>
              <RandomizeButton onClick={handleRandomize}>
                <RandomizeIcon>
                  <img src={randomizeIconSvg} alt="" width="22" height="24" />
                </RandomizeIcon>
                {t('quick_setup.randomize')}
              </RandomizeButton>
            </RandomizeBar>
            <SubText>{t('quick_setup.customize_later')}</SubText>
          </RightSection>
        )}
      </ContentWrapper>
    </PageContainer>
  )
}
