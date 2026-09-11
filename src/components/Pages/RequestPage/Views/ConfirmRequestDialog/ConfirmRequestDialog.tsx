import { formatEther } from 'viem'
import { useTranslation } from '@dcl/hooks'
import { CircularProgress, Dialog, muiIcons } from 'decentraland-ui2'
import { getNativeSymbol } from '../../../../../shared/explorer'
import { ConfirmRequestDialogProps } from './ConfirmRequestDialog.types'
import { Actions, CancelButton, ConfirmButton, Container, GasLine, IconCircle, Message, Title } from './ConfirmRequestDialog.styled'

const SendIcon = muiIcons.SendRounded
const SignIcon = muiIcons.DrawRounded

/**
 * The second confirmation step web2 users get on every Allow. Their wallet (Magic, Thirdweb) has no
 * prompt of its own, so this is the moment that says, one more time and in one sentence, what is
 * about to happen and what it costs. The review screen behind it has already shown the details.
 */
export const ConfirmRequestDialog = ({ open, kind, gas, isLoading = false, onCancel, onConfirm }: ConfirmRequestDialogProps) => {
  const { t } = useTranslation()
  const Icon = kind === 'transaction' ? SendIcon : SignIcon

  let gasLine: string | null = null
  if (gas) {
    if (gas.covered) {
      gasLine = t('request.transaction_dialog.gas_covered')
    } else if (gas.status === 'ready') {
      gasLine = t('request.transaction_dialog.fee_estimate', {
        cost: formatEther(gas.cost),
        symbol: getNativeSymbol(gas.chainId) || t('request.transaction_dialog.native_currency')
      })
    } else if (gas.status === 'unavailable') {
      gasLine = t('request.transaction_dialog.fee_unavailable')
    } else {
      gasLine = t('request.transaction_dialog.fee_loading')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={isLoading ? undefined : onCancel}
      aria-labelledby="confirm-request-title"
      PaperProps={{ sx: { background: 'transparent', boxShadow: 'none', overflow: 'visible' } }}
      slotProps={{ backdrop: { sx: { backgroundColor: 'rgba(0, 0, 0, 0.6)' } } }}
    >
      <Container data-testid="confirm-request-dialog" data-kind={kind}>
        <IconCircle aria-hidden="true">
          <Icon sx={{ fontSize: 28 }} />
        </IconCircle>
        <Title id="confirm-request-title">
          {t(kind === 'transaction' ? 'request.transaction_dialog.title' : 'request.transaction_dialog.title_signature')}
        </Title>
        <Message>
          {t(kind === 'transaction' ? 'request.transaction_dialog.summary_transaction' : 'request.transaction_dialog.summary_signature')}
        </Message>
        {gasLine ? <GasLine data-testid="confirm-request-gas">{gasLine}</GasLine> : null}
        <Actions>
          <CancelButton variant="outlined" onClick={onCancel} disabled={isLoading} data-testid="confirm-request-cancel">
            {t('common.cancel')}
          </CancelButton>
          <ConfirmButton variant="contained" onClick={onConfirm} disabled={isLoading} data-testid="confirm-request-confirm">
            {isLoading ? <CircularProgress size={20} color="inherit" /> : t('common.confirm')}
          </ConfirmButton>
        </Actions>
      </Container>
    </Dialog>
  )
}
