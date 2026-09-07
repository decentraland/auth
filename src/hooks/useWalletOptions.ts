import { useMemo } from 'react'
import { ConnectionOptionType, SignInOptionsMode } from '../components/Connection/Connection.types'

type ConnectionOptions = {
  primary: ConnectionOptionType
  secondary?: ConnectionOptionType
  extraOptions?: ConnectionOptionType[]
}

type UseWalletOptionsParams = {
  connectionOptions?: ConnectionOptions
  signInOptionsMode?: SignInOptionsMode
}

type WalletOptions = {
  firstWalletOption: ConnectionOptionType | undefined
  secondWalletOption: ConnectionOptionType | undefined
  remainingWalletOptions: ConnectionOptionType[] | undefined
}

export const useWalletOptions = ({ connectionOptions, signInOptionsMode }: UseWalletOptionsParams): WalletOptions => {
  return useMemo(() => {
    // Include primary in wallet options when it's not EMAIL (EMAIL is handled by EmailInput)
    const primaryIsWallet = connectionOptions?.primary && connectionOptions.primary !== ConnectionOptionType.EMAIL
    const allWalletOptions = [
      ...(primaryIsWallet ? [connectionOptions.primary] : []),
      connectionOptions?.secondary,
      ...(connectionOptions?.extraOptions ?? [])
    ].filter((opt): opt is ConnectionOptionType => opt !== undefined)

    // FULL mode: Show all options normally (legacy behavior)
    if (!signInOptionsMode || signInOptionsMode === SignInOptionsMode.FULL) {
      if (primaryIsWallet) {
        return {
          firstWalletOption: connectionOptions.primary,
          secondWalletOption: connectionOptions?.secondary,
          remainingWalletOptions: connectionOptions?.extraOptions
        }
      }
      return {
        firstWalletOption: connectionOptions?.secondary,
        secondWalletOption: connectionOptions?.extraOptions?.[0],
        remainingWalletOptions: connectionOptions?.extraOptions?.slice(1)
      }
    }

    // For ONE and TWO modes: determine which wallet options to show
    const hasEthereumProvider = !!window.ethereum
    const isMobileMetaMaskBrowser =
      hasEthereumProvider && !!(window.ethereum as { isMetaMask?: boolean })?.isMetaMask && /Mobi|Android/i.test(navigator.userAgent)
    const googleOption = allWalletOptions.find(opt => opt === ConnectionOptionType.GOOGLE)
    const metamaskOption = allWalletOptions.find(opt => opt === ConnectionOptionType.METAMASK)
    const walletConnectOption = allWalletOptions.find(opt => opt === ConnectionOptionType.WALLET_CONNECT)

    // On mobile MetaMask browser, prefer WalletConnect over MetaMask
    const preferredWalletOption = isMobileMetaMaskBrowser && walletConnectOption ? walletConnectOption : metamaskOption

    // TWO mode: Show Google + wallet option (if Ethereum provider exists)
    if (signInOptionsMode === SignInOptionsMode.TWO) {
      if (hasEthereumProvider && preferredWalletOption) {
        return {
          firstWalletOption: googleOption,
          secondWalletOption: preferredWalletOption,
          remainingWalletOptions: allWalletOptions.filter(opt => opt !== googleOption && opt !== preferredWalletOption)
        }
      }

      // No Ethereum provider: Show only Google
      return {
        firstWalletOption: googleOption,
        secondWalletOption: undefined,
        remainingWalletOptions: allWalletOptions.filter(opt => opt !== googleOption)
      }
    }

    // ONE mode: Show wallet option (if Ethereum provider exists) or nothing
    if (hasEthereumProvider && preferredWalletOption) {
      return {
        firstWalletOption: preferredWalletOption,
        secondWalletOption: undefined,
        remainingWalletOptions: allWalletOptions.filter(opt => opt !== preferredWalletOption)
      }
    }

    // No Ethereum provider: All go to "More options" (Google first, MetaMask second)
    const otherOptions = allWalletOptions.filter(opt => opt !== googleOption && opt !== metamaskOption)
    const orderedOptions = [googleOption, metamaskOption, ...otherOptions].filter((opt): opt is ConnectionOptionType => opt !== undefined)

    return {
      firstWalletOption: undefined,
      secondWalletOption: undefined,
      remainingWalletOptions: orderedOptions
    }
  }, [connectionOptions, signInOptionsMode])
}
