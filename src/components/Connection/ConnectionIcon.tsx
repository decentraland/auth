// eslint-disable-next-line @typescript-eslint/naming-convention
import * as React from 'react'
import { SvgIcon } from 'decentraland-ui2'
import appleSvg from '../../assets/images/apple.svg'
import coinbaseSvg from '../../assets/images/coinbase.svg'
import dapperPng from '../../assets/images/dapper.png'
import discordSvg from '../../assets/images/discord.svg'
import fortmaticPng from '../../assets/images/fortmatic.png'
import googleSvg from '../../assets/images/google.svg'
import metamaskSvg from '../../assets/images/metamask.svg'
import samsungSvg from '../../assets/images/samsung-blockchain-wallet.svg'
import walletConnectPng from '../../assets/images/wallet-connect.png'
import xSvg from '../../assets/images/x.svg'
import { ConnectionOptionType } from './Connection.types'
import { ConnectionIconProps } from './ConnectionIcon.types'
import { IconWrapper } from './ConnectionIcon.styled'

const createIconComponent = (src: string) => {
  const IconComponent = React.forwardRef<SVGSVGElement>((props, ref) => (
    <svg ref={ref} {...props} viewBox="0 0 32 32">
      <image href={src} width="32" height="32" />
    </svg>
  ))
  IconComponent.displayName = 'IconComponent'
  return IconComponent
}

// Build one icon component per asset ONCE at module load. Creating them inside the render (as
// `createIconComponent(src)` per case) produced a fresh component type every render, so React
// unmounted and remounted the icon's DOM on each parent re-render — e.g. LoginPage re-renders every
// 5s for its background rotation, which was tearing down and rebuilding every visible icon.
const ICON_BY_TYPE: Partial<Record<ConnectionOptionType, ReturnType<typeof createIconComponent>>> = {
  [ConnectionOptionType.APPLE]: createIconComponent(appleSvg),
  [ConnectionOptionType.COINBASE]: createIconComponent(coinbaseSvg),
  [ConnectionOptionType.DAPPER]: createIconComponent(dapperPng),
  [ConnectionOptionType.DISCORD]: createIconComponent(discordSvg),
  [ConnectionOptionType.FORTMATIC]: createIconComponent(fortmaticPng),
  [ConnectionOptionType.GOOGLE]: createIconComponent(googleSvg),
  [ConnectionOptionType.METAMASK]: createIconComponent(metamaskSvg),
  [ConnectionOptionType.METAMASK_MOBILE]: createIconComponent(metamaskSvg),
  [ConnectionOptionType.SAMSUNG]: createIconComponent(samsungSvg),
  [ConnectionOptionType.WALLET_CONNECT]: createIconComponent(walletConnectPng),
  // WalletLink (Coinbase Wallet) reuses the Coinbase icon.
  [ConnectionOptionType.WALLET_LINK]: createIconComponent(coinbaseSvg),
  [ConnectionOptionType.X]: createIconComponent(xSvg)
}

export const ConnectionIcon = ({ type }: ConnectionIconProps): JSX.Element | null => {
  const IconComponent = ICON_BY_TYPE[type]

  if (!IconComponent) {
    return null
  }

  return (
    <IconWrapper role="img" aria-label={type}>
      <SvgIcon component={IconComponent} fontSize="large" />
    </IconWrapper>
  )
}
