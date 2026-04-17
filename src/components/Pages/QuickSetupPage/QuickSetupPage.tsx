import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { CircularProgress, useMobileMediaQuery } from 'decentraland-ui2'
import bodyTypeIconSvg from '../../../assets/images/body-type-icon.svg'
import randomizeIconSvg from '../../../assets/images/randomize-icon.svg'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useCurrentConnectionData } from '../../../shared/connection'
import { trackCheckpoint } from '../../../shared/onboarding/trackCheckpoint'
import { handleError } from '../../../shared/utils/errorHandler'
import { AnimatedBackground } from '../../AnimatedBackground'
import { CustomWearablePreview } from '../../CustomWearablePreview'
import { deployProfileFromDefault, subscribeToNewsletter } from '../SetupPage/utils'
import {
  AvatarWrapper,
  BackgroundShadow,
  BodyTypeButton,
  BodyTypeChevron,
  BodyTypeDropdown,
  BodyTypeDropdownItem,
  CelebrationAvatarWrapper,
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

function getRandomDefaultProfile(bodyType: BodyType) {
  if (bodyType === 'A') {
    return 'default' + (Math.floor(Math.random() * 80) + 1)
  }
  return 'default' + (Math.floor(Math.random() * 80) + 81)
}

export const QuickSetupPage = () => {
  const { t } = useTranslation()
  const { redirect } = useAfterLoginRedirection()
  const { account, identity } = useCurrentConnectionData()
  const isMobile = useMobileMediaQuery()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [bodyType, setBodyType] = useState<BodyType>('A')
  const [profile, setProfile] = useState(() => getRandomDefaultProfile('A'))
  const [showCelebration, setShowCelebration] = useState(false)
  const [bodyTypeOpen, setBodyTypeOpen] = useState(false)
  const [celebrationLoading, setCelebrationLoading] = useState(true)
  const bodyTypeRef = useRef<HTMLDivElement>(null)

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

  const wearablePreviewUrl = useMemo(() => {
    if (!account) return ''
    const baseUrl = 'https://wearable-preview.decentraland.org'
    return `${baseUrl}/?profile=${account}&disableBackground=true&lockBeta=true&unity=true&mode=jesus`
  }, [account])

  const disabledCatalysts = useMemo(() => [] as string[], [])

  const nameError = name.length > MAX_NAME_LENGTH
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

        if (email.trim()) {
          try {
            await subscribeToNewsletter(email.trim())
          } catch (err) {
            handleError(err, 'Error subscribing to newsletter', { skipTracking: true })
          }
        }

        trackCheckpoint({
          checkpointId: 3,
          action: 'completed',
          source: 'auth',
          userIdentifier: account.toLowerCase(),
          identifierType: 'wallet',
          wallet: account.toLowerCase()
        })

        setShowCelebration(true)
      } catch (err) {
        const errorMessage = handleError(err, 'Error deploying profile')
        setDeployError(errorMessage)
        setDeploying(false)
      }
    },
    [canSubmit, account, identity, profile, name, email, disabledCatalysts]
  )

  if (showCelebration) {
    return (
      <PageContainer>
        <AnimatedBackground variant="absolute" />
        <CelebrationBackground />
        <CelebrationOverlay>
          <CelebrationTitle>{t('quick_setup.ready_to_jump_in', { name: name.trim() })}</CelebrationTitle>
          <CelebrationAvatarWrapper>
            {celebrationLoading && <CircularProgress size={60} />}
            <iframe
              src={wearablePreviewUrl}
              title="Avatar Preview"
              onLoad={() => setCelebrationLoading(false)}
              style={{ opacity: celebrationLoading ? 0 : 1, transition: 'opacity 0.3s' }}
            />
          </CelebrationAvatarWrapper>
          <SuccessButton variant="contained" onClick={() => redirect()}>
            {t('quick_setup.success')}
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

            <InputLabel>{t('quick_setup.email_label')}</InputLabel>
            <UsernameInput
              placeholder={t('quick_setup.email_placeholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              fullWidth
            />
            <EmailHelperText>{t('quick_setup.email_helper')}</EmailHelperText>

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
                  <img src={bodyTypeIconSvg} alt="" width="24" height="24" />
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
                      <img src={bodyTypeIconSvg} alt="" width="24" height="24" />
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
                          <path d="M1 5L4.5 8.5L12 1" stroke="#161518" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </BodyTypeDropdownItem>
                    <BodyTypeDropdownItem selected={bodyType === 'B'} onClick={() => handleSelectBodyType('B')}>
                      <img src={bodyTypeIconSvg} alt="" width="24" height="24" />
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
                          <path d="M1 5L4.5 8.5L12 1" stroke="#161518" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
