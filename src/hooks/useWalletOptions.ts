import { useMemo } from 'react'
import { ConnectionOptionType } from '../components/Connection/Connection.types'

type ConnectionOptions = {
  primary: ConnectionOptionType
  secondary?: ConnectionOptionType
  extraOptions?: ConnectionOptionType[]
}

type UseWalletOptionsParams = {
  connectionOptions?: ConnectionOptions
  isOnlyEmailOption?: boolean
  isSignInWithTwoOptions?: boolean
}

type WalletOptions = {
  firstWalletOption: ConnectionOptionType | undefined
  secondWalletOption: ConnectionOptionType | undefined
  remainingWalletOptions: ConnectionOptionType[] | undefined
}

export const useWalletOptions = ({
  connectionOptions,
  isOnlyEmailOption,
  isSignInWithTwoOptions
}: UseWalletOptionsParams): WalletOptions => {
  return useMemo(() => {
    const allWalletOptions = [connectionOptions?.secondary, ...(connectionOptions?.extraOptions ?? [])].filter(
      (opt): opt is ConnectionOptionType => opt !== undefined
    )

    // Current/Old behavior: show all options normally (when isOnlyEmailOption is disabled)
    if (!isOnlyEmailOption) {
      return {
        firstWalletOption: connectionOptions?.secondary,
        secondWalletOption: connectionOptions?.extraOptions?.[0],
        remainingWalletOptions: connectionOptions?.extraOptions?.slice(1)
      }
    }

    // New behavior when isOnlyEmailOption FF is enabled
    const hasEthereumProvider = !!window.ethereum
    const googleOption = allWalletOptions.find(opt => opt === ConnectionOptionType.GOOGLE)
    const metamaskOption = allWalletOptions.find(opt => opt === ConnectionOptionType.METAMASK)

    // TWO options mode: Show Google + MetaMask (if Ethereum provider exists)
    if (isSignInWithTwoOptions) {
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

    // ONE option mode: Show MetaMask (if Ethereum provider exists) or nothing
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
  }, [connectionOptions, isOnlyEmailOption, isSignInWithTwoOptions])
}
