import { formatEther } from 'viem'
import { useTranslation } from '@dcl/hooks'
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from 'decentraland-ui2'
import { SimulationSummary } from '../SimulationSummary'
import { TransactionConfirmDialogProps } from './TransactionConfirmDialog.types'
import { DialogBody, GasInfo, GasLine } from './TransactionConfirmDialog.styled'

export const TransactionConfirmDialog = ({
  open,
  transactionCost,
  balance,
  simulation,
  userAddress,
  profiles,
  gasCovered = false,
  isLoading,
  onCancel,
  onConfirm
}: TransactionConfirmDialogProps) => {
  const { t } = useTranslation()
  const isReverted = simulation.status === 'ready' && simulation.result.status === 'reverted'

  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle>{t('request.transaction_dialog.title')}</DialogTitle>
      <DialogContent>
        <DialogBody>
          <SimulationSummary simulation={simulation} userAddress={userAddress} profiles={profiles} />
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
        </DialogBody>
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
