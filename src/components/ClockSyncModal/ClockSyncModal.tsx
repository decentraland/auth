import React from 'react'
import { Modal } from 'decentraland-ui/dist/components/Modal/Modal'
import { ModalNavigation } from 'decentraland-ui/dist/components/ModalNavigation/ModalNavigation'
import warningIcon from '../../assets/images/warning.svg'
import { Actions, Content, ContinueButton, Message, WarningIcon, Title } from './ClockSyncModal.styled'
import { ClockSyncModalProps } from './ClockSyncModal.types'

export const ClockSyncModal: React.FC<ClockSyncModalProps> = ({ open, onContinue, onClose }) => {
  return (
    <Modal open={open} size="tiny">
      <ModalNavigation title="" onClose={onClose} />
      <Content>
        <WarningIcon src={warningIcon} alt="warning" />
        <Title>Device Clock Out of Sync</Title>
        <Message>Please update your computer's time settings to the correct local time to avoid server timeout issues.</Message>
        <Actions>
          <ContinueButton variant="contained" onClick={onContinue}>
            Continue to site
          </ContinueButton>
        </Actions>
      </Content>
    </Modal>
  )
}
