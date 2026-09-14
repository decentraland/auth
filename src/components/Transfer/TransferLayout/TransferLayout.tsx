import { AnimatedBackground } from '../../AnimatedBackground'
import { TransferLayoutProps } from './TransferLayout.types'
import { LayoutRoot, Main } from './TransferLayout.styled'

const TransferLayout = ({ children, scrollable }: TransferLayoutProps) => {
  return (
    <LayoutRoot>
      <AnimatedBackground />
      <Main scrollable={scrollable}>{children}</Main>
    </LayoutRoot>
  )
}

export { TransferLayout }
