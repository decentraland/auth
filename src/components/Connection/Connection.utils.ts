import { ConnectionOptionType, MetamaskEthereumWindow } from './Connection.types'

export function shouldDisableMetaMask(option: ConnectionOptionType): boolean {
  if (option !== ConnectionOptionType.METAMASK) {
    return false
  }

  const isMetamaskAvailable = (window.ethereum as MetamaskEthereumWindow)?.isMetaMask
  return !isMetamaskAvailable
}
