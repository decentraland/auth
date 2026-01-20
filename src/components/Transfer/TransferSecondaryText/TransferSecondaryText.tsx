import { SecondaryTextContainer } from './TransferSecondaryText.styled'
import { TransferSecondaryTextProps } from './TransferSecondaryText.types'

const TransferSecondaryText = ({ children }: TransferSecondaryTextProps) => {
  return <SecondaryTextContainer>{children}</SecondaryTextContainer>
}

export { TransferSecondaryText }
