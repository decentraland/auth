import { TransferLayoutContainer } from './TransferLayout.styled'
import { TransferLayoutProps } from './TransferLayout.types'

const TransferLayout = ({ children }: TransferLayoutProps) => {
  return <TransferLayoutContainer>{children}</TransferLayoutContainer>
}

export { TransferLayout }
