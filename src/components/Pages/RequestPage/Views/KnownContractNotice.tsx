import { useTranslation } from '@dcl/hooks'
import { Alert } from 'decentraland-ui2'
import { ADDRESS_REGEX } from '../../../../shared/auth'
import { getNetworkName } from '../../../../shared/explorer'
import { isKnownDecentralandContractOnChain } from '../utils'

/**
 * A positive identification of a published deployment, not a safety verdict. Relayer acceptance,
 * token metadata and simulation counterparties are deliberately not evidence for this notice.
 * No match means no claim: an unlisted collection may still be a Decentraland collection.
 */
export const KnownContractNotice = ({ address, chainId }: { address?: string; chainId?: number }) => {
  const { t } = useTranslation()
  const network = getNetworkName(chainId)
  if (
    !address ||
    !ADDRESS_REGEX.test(address) ||
    chainId === undefined ||
    !network ||
    !isKnownDecentralandContractOnChain(address, chainId)
  ) {
    return null
  }
  return <Alert severity="info">{t('request.transaction_dialog.known_contract', { network })}</Alert>
}
