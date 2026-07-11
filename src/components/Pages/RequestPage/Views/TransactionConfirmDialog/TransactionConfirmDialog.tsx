import { formatEther } from 'viem'
import { useTranslation } from '@dcl/hooks'
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from 'decentraland-ui2'
import { TransactionConfirmDialogProps } from './TransactionConfirmDialog.types'
import { GasInfo, GasLine } from './TransactionConfirmDialog.styled'

// A deliberately simple final-confirm step: the asset-change summary is shown earlier, on the
// interaction screen, so this dialog only surfaces the gas cost (or that gas is covered) and
// asks for a last confirmation.
export const TransactionConfirmDialog = ({
  open,
  transactionCost,
  balance,
  gasCovered = false,
  isReverted = false,
  isLoading,
  onCancel,
  onConfirm
}: TransactionConfirmDialogProps) => {
  const { t } = useTranslation()

  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle>{t('request.transaction_dialog.title')}</DialogTitle>
      <DialogContent>
        <GasInfo>
          {gasCovered ? (
            <GasLine>{t('request.transaction_dialog.gas_covered')}</GasLine>
          ) : (
            <>
              <GasLine>{t('request.transaction_dialog.transaction_cost', { cost: formatEther(transactionCost) })}</GasLine>
              <GasLine>{t('request.transaction_dialog.your_balance', { balance: formatEther(balance) })}</GasLine>
            </>
          )}
        </GasInfo>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" color={isReverted ? 'error' : 'primary'} onClick={onConfirm} disabled={isLoading}>
          {isLoading ? <CircularProgress size={20} color="inherit" /> : t('common.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
