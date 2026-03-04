import { TransferSecondaryTextProps } from './TransferSecondaryText.types'
import { SecondaryTextContainer } from './TransferSecondaryText.styled'

const TransferSecondaryText = ({ children }: TransferSecondaryTextProps) => {
  return <SecondaryTextContainer>{children}</SecondaryTextContainer>
}

export { TransferSecondaryText }
