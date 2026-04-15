import { useTranslation } from '@dcl/hooks'
import { AnimatedBackground } from '../../AnimatedBackground'
import {
  AvatarErrorSection,
  BackgroundShadow,
  ContentWrapper,
  Description,
  ErrorIcon,
  LeftSection,
  PageContainer,
  RightSection,
  StyledLogo,
  Title,
  TitleRow,
  TryAgainButton
} from './LoginErrorPage.styled'

type LoginErrorPageProps = {
  onTryAgain: () => void
}

export const LoginErrorPage = ({ onTryAgain }: LoginErrorPageProps) => {
  const { t } = useTranslation()

  return (
    <PageContainer>
      <AnimatedBackground variant="absolute" />
      <BackgroundShadow />
      <StyledLogo size="huge" />
      <ContentWrapper>
        <LeftSection>
          <TitleRow>
            <ErrorIcon>
              <svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="23" cy="23" r="23" fill="#FF2D55" />
                <path d="M15 15L31 31M31 15L15 31" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </ErrorIcon>
            <Title>{t('login_error.title')}</Title>
          </TitleRow>
          <Description>{t('login_error.description')}</Description>
          <TryAgainButton variant="contained" onClick={onTryAgain}>
            {t('login_error.try_again')}
          </TryAgainButton>
        </LeftSection>
        <RightSection>
          <AvatarErrorSection />
        </RightSection>
      </ContentWrapper>
    </PageContainer>
  )
}
