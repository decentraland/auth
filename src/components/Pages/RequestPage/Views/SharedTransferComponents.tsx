import { ReactNode } from 'react'
import {
  ProgressContainer,
  ProgressTrack,
  ProgressSpinner,
  LoadingContainer,
  LoadingText,
  ButtonsContainer,
  CancelButton,
  ConfirmButton
} from './SharedTransferComponents.styled'

// ============================================
// CIRCULAR PROGRESS COMPONENT
// ============================================

export const CircularProgressWithTrack = () => {
  return (
    <ProgressContainer>
      <ProgressTrack variant="determinate" value={100} size={30} thickness={4} />
      <ProgressSpinner variant="indeterminate" disableShrink size={30} thickness={4} />
    </ProgressContainer>
  )
}

// ============================================
// LOADING STATE COMPONENT
// ============================================

type LoadingStateProps = {
  text?: string
}

export const LoadingState = ({ text = 'Processing Authorization' }: LoadingStateProps) => {
  return (
    <LoadingContainer>
      <CircularProgressWithTrack />
      <LoadingText>{text}</LoadingText>
    </LoadingContainer>
  )
}

// ============================================
// ACTION BUTTONS COMPONENT
// ============================================

type ActionButtonsProps = {
  isLoading: boolean
  onCancel: () => void
  onConfirm: () => void
  cancelText?: string
  confirmText?: string
}

export const ActionButtons = ({
  isLoading,
  onCancel,
  onConfirm,
  cancelText = 'CANCEL',
  confirmText = 'CONFIRM & SEND'
}: ActionButtonsProps) => {
  return (
    <ButtonsContainer>
      <CancelButton variant="contained" size="large" disabled={isLoading} onClick={onCancel} fullWidth>
        {cancelText}
      </CancelButton>
      <ConfirmButton variant="contained" size="large" disabled={isLoading} onClick={onConfirm} fullWidth>
        {confirmText}
      </ConfirmButton>
    </ButtonsContainer>
  )
}

// ============================================
// TRANSFER LAYOUT WRAPPER
// ============================================

type TransferLayoutProps = {
  children: ReactNode
}

export const TransferLayout = ({ children }: TransferLayoutProps) => {
  return <>{children}</>
}
