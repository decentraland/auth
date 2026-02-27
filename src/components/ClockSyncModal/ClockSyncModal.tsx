import * as React from 'react'
import { Dialog, muiIcons } from 'decentraland-ui2'
import warningIcon from '../../assets/images/warning.svg'
import { Actions, CloseIconButton, Content, ContinueButton, Message, WarningIcon, Title } from './ClockSyncModal.styled'
import { ClockSyncModalProps } from './ClockSyncModal.types'

const CloseIcon = muiIcons.Close

export const ClockSyncModal: React.FC<ClockSyncModalProps> = ({ open, onContinue, onClose }) => {
  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <CloseIconButton onClick={onClose}>
        <CloseIcon />
      </CloseIconButton>
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
    </Dialog>
  )
}
