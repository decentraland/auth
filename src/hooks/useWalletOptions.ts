import { useMemo } from 'react'
import { ConnectionOptionType, ConnectionOptions, SignInOptionsMode } from '../components/Connection/Connection.types'

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
    const googleOption = allWalletOptions.find(opt => opt === ConnectionOptionType.GOOGLE)
    const metamaskOption = allWalletOptions.find(opt => opt === ConnectionOptionType.METAMASK)

    // TWO mode: Show Google + MetaMask (if Ethereum provider exists)
    if (signInOptionsMode === SignInOptionsMode.TWO) {
      if (hasEthereumProvider && metamaskOption) {
        return {
          firstWalletOption: googleOption,
          secondWalletOption: metamaskOption,
          remainingWalletOptions: allWalletOptions.filter(opt => opt !== googleOption && opt !== metamaskOption)
        }
      }

      // No Ethereum provider: Show only Google
      return {
        firstWalletOption: googleOption,
        secondWalletOption: undefined,
        remainingWalletOptions: allWalletOptions.filter(opt => opt !== googleOption)
      }
    }

    // ONE mode: Show MetaMask (if Ethereum provider exists) or nothing
    if (hasEthereumProvider && metamaskOption) {
      return {
        firstWalletOption: metamaskOption,
        secondWalletOption: undefined,
        remainingWalletOptions: allWalletOptions.filter(opt => opt !== metamaskOption)
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
