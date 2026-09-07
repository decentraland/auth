import { useTranslation } from '@dcl/hooks'
import { Button } from 'decentraland-ui2'

/**
 * Starts a fresh review of the same request. It never signs, submits or reports an outcome: the page
 * recovers the request again and every check runs anew. Offered only while a preview is unavailable and
 * a retry could still produce one.
 */
export const RetryPreviewButton = ({ disabled = false, onRetry }: { disabled?: boolean; onRetry: () => void }) => {
  const { t } = useTranslation()
  return (
    <Button variant="outlined" disabled={disabled} onClick={onRetry} data-testid="retry-preview-button">
      {t('request.transaction_dialog.retry_preview')}
    </Button>
  )
}
