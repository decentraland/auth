export type MagicInformationModalProps = {
  onClose: () => unknown
  open: boolean
  i18n?: MagicInformationModalI18N
}

export type MagicInformationModalI18N = {
  title: string
  subtitle: string
  goBack: string
}
