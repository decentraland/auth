import { useTranslation } from '@dcl/hooks'
import { Dialog, muiIcons } from 'decentraland-ui2'
import { CloseButton, ErrorCircle, Message, ModalContainer, TryAgainButton } from './WalletErrorModal.styled'

const CloseIcon = muiIcons.Close

type WalletErrorModalProps = {
  open: boolean
  onTryAgain: () => void
  onClose: () => void
}

export const WalletErrorModal = ({ open, onTryAgain, onClose }: WalletErrorModalProps) => {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-label={t('wallet_error_modal.title')}
      PaperProps={{ sx: { background: 'transparent', boxShadow: 'none', overflow: 'visible' } }}
      slotProps={{ backdrop: { sx: { backgroundColor: 'rgba(0, 0, 0, 0.6)' } } }}
    >
      <ModalContainer>
        <CloseButton onClick={onClose} aria-label={t('common.close_window')} data-testid="wallet-error-close-button">
          <CloseIcon sx={{ fontSize: 14 }} />
        </CloseButton>
        <ErrorCircle>
          <svg width="30" height="27" viewBox="0 0 30 27" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M13.268 1.5C14.0378 0.166667 15.9623 0.166667 16.7321 1.5L28.8565 22.5C29.6263 23.8333 28.664 25.5 27.1244 25.5H2.87565C1.33605 25.5 0.373749 23.8333 1.14355 22.5L13.268 1.5Z"
              fill="white"
              fillOpacity="0"
              stroke="white"
              strokeWidth="2"
            />
            <path d="M15 9V16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="15" cy="20.5" r="1.5" fill="white" />
          </svg>
        </ErrorCircle>
        <Message>{t('wallet_error_modal.message')}</Message>
        <TryAgainButton variant="contained" onClick={onTryAgain} data-testid="wallet-error-try-again-button">
          {t('wallet_error_modal.try_again')}
        </TryAgainButton>
      </ModalContainer>
    </Dialog>
  )
}
