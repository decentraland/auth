import { useTranslation } from '@dcl/hooks'
import { CircularProgress } from 'decentraland-ui2'
import { AnimatedBackground } from '../AnimatedBackground'
import {
  ConnectionContainer,
  ConnectionTitle,
  DecentralandLogo,
  ProgressContainer
} from '../ConnectionModal/ConnectionLayout.styled'
import { Container, Wrapper } from './VerifyingCredentialsView.styled'

type Props = {
  /** Translation key for the label shown above the spinner. Defaults to the callback-page message for visual continuity. */
  messageKey?: string
}

// Shared loading view used in transitional states (LoadingRequest, DefaultPage, etc.)
// Mirrors the CallbackPage layout so the user perceives one continuous "verifying" phase
// instead of a bare spinner flash between screens.
export const VerifyingCredentialsView = ({ messageKey = 'connection_layout.validating_sign_in' }: Props) => {
  const { t } = useTranslation()
  return (
    <Container>
      <AnimatedBackground variant="absolute" />
      <Wrapper>
        <ConnectionContainer>
          <DecentralandLogo size="huge" />
          <ConnectionTitle data-testid="verifying-credentials-title">{t(messageKey)}</ConnectionTitle>
          <ProgressContainer>
            <CircularProgress color="inherit" />
          </ProgressContainer>
        </ConnectionContainer>
      </Wrapper>
    </Container>
  )
}
