import { ConnectionOptionType, Connection, ConnectionProps } from '../../Connection'
import { Background, Content, Main, MobileConnectionWrapper } from './MobileAuthPage.styled'

type Props = {
  onConnect: (type: ConnectionOptionType) => void
  loadingOption?: ConnectionOptionType
  connectionOptions: NonNullable<ConnectionProps['connectionOptions']>
}

export const MobileProviderSelection = ({ onConnect, loadingOption, connectionOptions }: Props) => {
  return (
    <Main component="main">
      <Background />
      <Content>
        <MobileConnectionWrapper>
          <Connection onConnect={onConnect} loadingOption={loadingOption} connectionOptions={connectionOptions} />
        </MobileConnectionWrapper>
      </Content>
    </Main>
  )
}
