import { useTranslation } from '@dcl/hooks'
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from 'decentraland-ui2'
import { TransactionConfirmDialogProps } from './TransactionConfirmDialog.types'
import { GasInfo, GasLine } from './TransactionConfirmDialog.styled'

// The second confirmation step web2 users get behind "CONFIRM & SEND" on the branded tip and gift
// screens. Both flows are relayed through the gas tank, so the only thing left to say is that gas
// is covered; the generic reviews show their gas inline and approve in a single step instead.
export const TransactionConfirmDialog = ({ open, isLoading = false, onCancel, onConfirm }: TransactionConfirmDialogProps) => {
  const { t } = useTranslation()

  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle>{t('request.transaction_dialog.title')}</DialogTitle>
      <DialogContent>
        <GasInfo>
          <GasLine>{t('request.transaction_dialog.gas_covered')}</GasLine>
        </GasInfo>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" onClick={onConfirm} disabled={isLoading}>
          {isLoading ? <CircularProgress size={20} color="inherit" /> : t('common.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
