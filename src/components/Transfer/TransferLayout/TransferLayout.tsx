import { AnimatedBackground } from '../../AnimatedBackground'
import { LayoutRoot, Main } from './TransferLayout.styled'
import { TransferLayoutProps } from './TransferLayout.types'

const TransferLayout = ({ children }: TransferLayoutProps) => {
  return (
    <LayoutRoot>
      <AnimatedBackground />
      <Main>{children}</Main>
    </LayoutRoot>
  )
}

export { TransferLayout }
