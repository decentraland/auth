import * as React from 'react'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import warningIcon from '../../assets/images/warning.svg'
import { Actions, Content, ContinueButton, Message, WarningIcon, Title } from './ClockSyncModal.styled'
import { ClockSyncModalProps } from './ClockSyncModal.types'

export const ClockSyncModal: React.FC<ClockSyncModalProps> = ({ open, onContinue, onClose }) => {
  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8, color: 'white' }}>
        <CloseIcon />
      </IconButton>
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
