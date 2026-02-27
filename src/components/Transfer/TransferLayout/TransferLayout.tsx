import { AnimatedBackground } from '../../AnimatedBackground'
import { TransferLayoutProps } from './TransferLayout.types'
import { LayoutRoot, Main } from './TransferLayout.styled'

const TransferLayout = ({ children }: TransferLayoutProps) => {
  return (
    <LayoutRoot>
      <AnimatedBackground />
      <Main>{children}</Main>
    </LayoutRoot>
  )
}

export { TransferLayout }
