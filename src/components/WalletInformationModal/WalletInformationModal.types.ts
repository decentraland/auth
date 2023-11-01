export type WalletInformationModalProps = {
  onClose: () => unknown
  open: boolean
  i18n?: WalletInformationModalI18N
}

export type WalletInformationModalI18N = {
  title: string
  assets: {
    title: string
    text: string
  }
  logIn: {
    title: string
    text: string
  }
}
