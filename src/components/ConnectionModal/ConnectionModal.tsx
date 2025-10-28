import { dclModal } from 'decentraland-ui2'
import CustomWelcomeBackground from '../../assets/images/background/custom-welcome-background.webp'
import { ConnectionLayout } from './ConnectionLayout'
import { ConnectionModalProps } from './ConnectionModal.types'

export const ConnectionModal = (props: ConnectionModalProps) => {
  const { open, state, providerType, onClose, onTryAgain } = props

  return (
    <dclModal.Modal
      open={open}
      backgroundImage={CustomWelcomeBackground}
      backgroundSize="cover"
      backgroundPosition="center"
      backgroundRepeat="no-repeat"
      size="small"
      onClose={onClose}
    >
      <ConnectionLayout state={state} providerType={providerType} onTryAgain={onTryAgain} />
    </dclModal.Modal>
  )
}
