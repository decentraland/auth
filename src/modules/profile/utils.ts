import { getCatalystServersFromCache } from 'dcl-catalyst-client/dist/contracts-snapshots'
import { L1Network } from '@dcl/catalyst-contracts'
import { config } from '../config'

const getCatalystServers = (network: L1Network, disabledCatalysts: string[] = []) => {
  const catalystServersFromCache = getCatalystServersFromCache(network)
  return catalystServersFromCache.filter(server => !disabledCatalysts.includes(server.address))
}

/**
 * Returns content API URLs for all available catalysts, with the configured PEER_URL first.
 * Used for deployment rotation — if the primary catalyst fails, subsequent URLs are tried in order.
 * @param disabledCatalysts - Catalyst addresses to exclude from the list
 * @returns Content URLs in the form `{catalystAddress}/content`
 */
function getCatalystUrlsForRotation(disabledCatalysts: string[] = []): string[] {
  const PEER_URL = config.get('PEER_URL')
  const environment = config.get('ENVIRONMENT')
  const network = environment === 'development' ? 'sepolia' : 'mainnet'
  const catalystServers = getCatalystServers(network, [PEER_URL, ...disabledCatalysts])

  return [PEER_URL + '/content', ...catalystServers.map(server => server.address + '/content')]
}

export { getCatalystServers, getCatalystUrlsForRotation }
