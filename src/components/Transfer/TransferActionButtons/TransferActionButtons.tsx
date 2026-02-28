import { useTranslation } from '@dcl/hooks'
import { TransferActionButtonsProps } from './TransferActionButtons.types'
import { ButtonsContainer, CancelButton, ConfirmButton } from './TransferActionButtons.styled'

const TransferActionButtons = ({ cancelText, confirmText, isLoading, onCancel, onConfirm }: TransferActionButtonsProps) => {
  const { t } = useTranslation()
  return (
    <ButtonsContainer>
      <CancelButton variant="contained" color="secondary" size="large" disabled={isLoading} onClick={onCancel} fullWidth>
        {cancelText ?? t('transfer.action_buttons.cancel')}
      </CancelButton>
      <ConfirmButton variant="contained" size="large" disabled={isLoading} onClick={onConfirm} fullWidth>
        {confirmText ?? t('transfer.action_buttons.confirm_send')}
      </ConfirmButton>
    </ButtonsContainer>
  )
}

export { TransferActionButtons }
