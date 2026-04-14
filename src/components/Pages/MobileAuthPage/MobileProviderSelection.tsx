import { Connection, ConnectionOptionType, ConnectionProps } from '../../Connection'
import { Background, Content, Main, MobileConnectionWrapper } from './MobileAuthPage.styled'

type Props = {
  onConnect: (type: ConnectionOptionType) => void
  loadingOption?: ConnectionOptionType
  connectionOptions: NonNullable<ConnectionProps['connectionOptions']>
  onEmailSubmit?: (email: string) => void
  onEmailChange?: () => void
  isEmailLoading?: boolean
  emailError?: string | null
}

export const MobileProviderSelection = ({
  onConnect,
  loadingOption,
  connectionOptions,
  onEmailSubmit,
  onEmailChange,
  isEmailLoading,
  emailError
}: Props) => {
  return (
    <Main component="main">
      <Background />
      <Content>
        <MobileConnectionWrapper>
          <Connection
            onConnect={onConnect}
            onEmailSubmit={onEmailSubmit}
            onEmailChange={onEmailChange}
            loadingOption={loadingOption}
            connectionOptions={connectionOptions}
            isEmailLoading={isEmailLoading}
            emailError={emailError}
          />
        </MobileConnectionWrapper>
      </Content>
    </Main>
  )
}
