// eslint-disable-next-line @typescript-eslint/naming-convention
import * as React from 'react'
import { useTranslation } from '@dcl/hooks'
import { Dialog, muiIcons } from 'decentraland-ui2'
import warningIcon from '../../assets/images/warning.svg'
import { ClockSyncModalProps } from './ClockSyncModal.types'
import { Actions, CloseIconButton, Content, ContinueButton, Message, Title, WarningIcon } from './ClockSyncModal.styled'

const CloseIcon = muiIcons.Close

export const ClockSyncModal: React.FC<ClockSyncModalProps> = ({ open, onContinue, onClose }) => {
  const { t } = useTranslation()
  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <CloseIconButton onClick={onClose}>
        <CloseIcon />
      </CloseIconButton>
      <Content>
        <WarningIcon src={warningIcon} alt="warning" />
        <Title>{t('clock_sync_modal.title')}</Title>
        <Message>{t('clock_sync_modal.message')}</Message>
        <Actions>
          <ContinueButton variant="contained" onClick={onContinue}>
            {t('clock_sync_modal.continue_to_site')}
          </ContinueButton>
        </Actions>
      </Content>
    </Dialog>
  )
}
