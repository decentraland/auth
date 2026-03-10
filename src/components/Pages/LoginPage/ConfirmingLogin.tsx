import { useTranslation } from '@dcl/hooks'
import { CircularProgress, Logo } from 'decentraland-ui2'
import { AnimatedBackground } from '../../AnimatedBackground'
import { Container, Content, RetryButton, Spinner, Subtitle, Title } from './ConfirmingLogin.styled'

export type ConfirmingLoginProps = {
  onError?: () => void
  error?: string | null
}

export const ConfirmingLogin = ({ error, onError }: ConfirmingLoginProps) => {
  const { t } = useTranslation()

  if (error) {
    return (
      <Container>
        <AnimatedBackground variant="absolute" />
        <Content>
          <Logo size="huge" />
          <Title>{t('common.something_went_wrong')}</Title>
          <Subtitle>{error}</Subtitle>
          {onError && <RetryButton onClick={onError} data-testid="confirming-login-retry-button">{t('common.try_again')}</RetryButton>}
        </Content>
      </Container>
    )
  }

  return (
    <Container>
      <AnimatedBackground variant="absolute" />
      <Content>
        <Logo size="huge" />
        <Title>{t('login.confirming_login')}</Title>
        <Spinner>
          <CircularProgress color="inherit" size={40} />
        </Spinner>
      </Content>
    </Container>
  )
}
