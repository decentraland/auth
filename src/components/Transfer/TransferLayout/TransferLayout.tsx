import { Background, LayoutRoot, Main } from './TransferLayout.styled'
import { TransferLayoutProps } from './TransferLayout.types'

const TransferLayout = ({ children }: TransferLayoutProps) => {
  return (
    <LayoutRoot>
      <Background />
      <Main>{children}</Main>
    </LayoutRoot>
  )
}

export { TransferLayout }
