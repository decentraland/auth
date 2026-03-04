import { AlertContainer } from './TransferAlert.styled'
import { TransferAlertProps } from './TransferAlert.types'

const DEFAULT_TEXT = 'You can close this tab and return to the Decentraland app.'

const TransferAlert = ({ children, severity = 'info', text, ...props }: TransferAlertProps) => {
  return (
    <AlertContainer severity={severity} {...props}>
      {children ?? text ?? DEFAULT_TEXT}
    </AlertContainer>
  )
}

export { TransferAlert }
