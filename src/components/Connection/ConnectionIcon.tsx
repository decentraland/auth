import { forwardRef } from 'react'
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
import { IconWrapper } from './ConnectionIcon.styled'
import { ConnectionOptionType } from './Connection.types'
import { ConnectionIconProps } from './ConnectionIcon.types'

const createIconComponent = (src: string) => {
  const IconComponent = forwardRef<SVGSVGElement>((props, ref) => (
    <svg ref={ref} {...props} viewBox="0 0 32 32">
      <image href={src} width="32" height="32" />
    </svg>
  ))
  IconComponent.displayName = 'IconComponent'
  return IconComponent
}

export const ConnectionIcon = ({ type }: ConnectionIconProps): JSX.Element | null => {
  // Rationale: use `aria-label` (not `ariaLabel`) so React's ARIA validation passes and screen readers can announce the icon.
  switch (type) {
    case ConnectionOptionType.APPLE:
      return (
        <IconWrapper role="img" aria-label={type}>
          <SvgIcon component={createIconComponent(appleSvg)} fontSize="large" />
        </IconWrapper>
      )
    case ConnectionOptionType.COINBASE:
      return (
        <IconWrapper role="img" aria-label={type}>
          <SvgIcon component={createIconComponent(coinbaseSvg)} fontSize="large" />
        </IconWrapper>
      )
    case ConnectionOptionType.DAPPER:
      return (
        <IconWrapper role="img" aria-label={type}>
          <SvgIcon component={createIconComponent(dapperPng)} fontSize="large" />
        </IconWrapper>
      )
    case ConnectionOptionType.DISCORD:
      return (
        <IconWrapper role="img" aria-label={type}>
          <SvgIcon component={createIconComponent(discordSvg)} fontSize="large" />
        </IconWrapper>
      )
    case ConnectionOptionType.FORTMATIC:
      return (
        <IconWrapper role="img" aria-label={type}>
          <SvgIcon component={createIconComponent(fortmaticPng)} fontSize="large" />
        </IconWrapper>
      )
    case ConnectionOptionType.GOOGLE:
      return (
        <IconWrapper role="img" aria-label={type}>
          <SvgIcon component={createIconComponent(googleSvg)} fontSize="large" />
        </IconWrapper>
      )
    case ConnectionOptionType.METAMASK:
      return (
        <IconWrapper role="img" aria-label={type}>
          <SvgIcon component={createIconComponent(metamaskSvg)} fontSize="large" />
        </IconWrapper>
      )
    case ConnectionOptionType.METAMASK_MOBILE:
      return (
        <IconWrapper role="img" aria-label={type}>
          <SvgIcon component={createIconComponent(metamaskSvg)} fontSize="large" />
        </IconWrapper>
      )
    case ConnectionOptionType.SAMSUNG:
      return (
        <IconWrapper role="img" aria-label={type}>
          <SvgIcon component={createIconComponent(samsungSvg)} fontSize="large" />
        </IconWrapper>
      )
    case ConnectionOptionType.WALLET_CONNECT:
      return (
        <IconWrapper role="img" aria-label={type}>
          <SvgIcon component={createIconComponent(walletConnectPng)} fontSize="large" />
        </IconWrapper>
      )
    case ConnectionOptionType.WALLET_LINK:
      return (
        <IconWrapper role="img" aria-label={type}>
          <SvgIcon component={createIconComponent(coinbaseSvg)} fontSize="large" />
        </IconWrapper>
      )
    case ConnectionOptionType.X:
      return (
        <IconWrapper role="img" aria-label={type}>
          <SvgIcon component={createIconComponent(xSvg)} fontSize="large" />
        </IconWrapper>
      )
    default:
      return null
  }
}
