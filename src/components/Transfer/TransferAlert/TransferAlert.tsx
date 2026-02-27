import { useTranslation } from '@dcl/hooks'
import { TransferAlertProps } from './TransferAlert.types'
import { AlertContainer } from './TransferAlert.styled'

const TransferAlert = ({ children, severity = 'info', text, ...props }: TransferAlertProps) => {
  const { t } = useTranslation()
  return (
    <AlertContainer severity={severity} {...props}>
      {children ?? text ?? t('transfer.alert.default_text')}
    </AlertContainer>
  )
}

export { TransferAlert }
