import { ButtonsContainer, CancelButton, ConfirmButton } from './TransferActionButtons.styled'
import { TransferActionButtonsProps } from './TransferActionButtons.types'

const TransferActionButtons = ({
  cancelText = 'CANCEL',
  confirmText = 'CONFIRM & SEND',
  isLoading,
  onCancel,
  onConfirm
}: TransferActionButtonsProps) => {
  return (
    <ButtonsContainer>
      <CancelButton variant="contained" color="secondary" size="large" disabled={isLoading} onClick={onCancel} fullWidth>
        {cancelText}
      </CancelButton>
      <ConfirmButton variant="contained" size="large" disabled={isLoading} onClick={onConfirm} fullWidth>
        {confirmText}
      </ConfirmButton>
    </ButtonsContainer>
  )
}

export { TransferActionButtons }
