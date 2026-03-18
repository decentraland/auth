import { useMemo } from 'react'
import { ConnectionOptionType, SignInOptionsMode } from '../components/Connection/Connection.types'
import { isPhantomAvailable } from '../components/Pages/LoginPage/utils'

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
    const hasPhantom = isPhantomAvailable()
    const googleOption = allWalletOptions.find(opt => opt === ConnectionOptionType.GOOGLE)
    const metamaskOption = allWalletOptions.find(opt => opt === ConnectionOptionType.METAMASK)
    const phantomOption = allWalletOptions.find(opt => opt === ConnectionOptionType.PHANTOM)
    
    // Determine which wallet to show: Phantom if available, otherwise MetaMask
    const walletOption = hasPhantom && phantomOption ? phantomOption : metamaskOption

    // TWO mode: Show Google + wallet (Phantom or MetaMask, depending on availability)
    if (signInOptionsMode === SignInOptionsMode.TWO) {
      if (hasEthereumProvider && walletOption) {
        return {
          firstWalletOption: googleOption,
          secondWalletOption: walletOption,
          remainingWalletOptions: allWalletOptions.filter(opt => opt !== googleOption && opt !== walletOption)
        }
      }

      // No Ethereum provider: Show only Google
      return {
        firstWalletOption: googleOption,
        secondWalletOption: undefined,
        remainingWalletOptions: allWalletOptions.filter(opt => opt !== googleOption)
      }
    }

    // ONE mode: Show wallet (Phantom or MetaMask, depending on availability) or nothing
    if (hasEthereumProvider && walletOption) {
      return {
        firstWalletOption: walletOption,
        secondWalletOption: undefined,
        remainingWalletOptions: allWalletOptions.filter(opt => opt !== walletOption)
      }
    }

    // No Ethereum provider: All go to "More options" (Google first, wallet second)
    const otherOptions = allWalletOptions.filter(opt => opt !== googleOption && opt !== walletOption)
    const orderedOptions = [googleOption, walletOption, ...otherOptions].filter((opt): opt is ConnectionOptionType => opt !== undefined)

    return {
      firstWalletOption: undefined,
      secondWalletOption: undefined,
      remainingWalletOptions: orderedOptions
    }
  }, [connectionOptions, signInOptionsMode])
}
