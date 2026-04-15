import { useCallback } from 'react'
import { useTranslation } from '@dcl/hooks'
import { AnimatedBackground } from '../../../AnimatedBackground'
import {
  ArrowIcon,
  AvatarAnimation,
  BackgroundShadow,
  CheckIcon,
  ContentWrapper,
  ContinueButton,
  Description,
  LeftSection,
  PageContainer,
  RightSection,
  StyledLogo,
  Title,
  TitleRow
} from './SignInCompletePage.styled'

const EXPLORER_DEEPLINK = 'decentraland://'

type Props = {
  onContinue?: () => void
}

export const SignInCompletePage = ({ onContinue }: Props) => {
  const { t } = useTranslation()

  const handleContinue = useCallback(() => {
    if (onContinue) {
      onContinue()
    }
    window.location.href = EXPLORER_DEEPLINK
  }, [onContinue])

  return (
    <PageContainer>
      <AnimatedBackground variant="absolute" />
      <BackgroundShadow />
      <StyledLogo size="huge" />
      <ContentWrapper>
        <LeftSection>
          <TitleRow>
            <CheckIcon>
              <svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="23" cy="23" r="23" fill="#34C759" />
                <path d="M13 23L20 30L33 17" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </CheckIcon>
            <Title>{t('request_views.sign_in_complete.title')}</Title>
          </TitleRow>
          <Description>{t('request_views.sign_in_complete.explorer_description')}</Description>
          <ContinueButton variant="contained" onClick={handleContinue}>
            {t('request_views.sign_in_complete.continue')}
            <ArrowIcon>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </ArrowIcon>
          </ContinueButton>
        </LeftSection>
        <RightSection>
          <AvatarAnimation />
        </RightSection>
      </ContentWrapper>
    </PageContainer>
  )
}
