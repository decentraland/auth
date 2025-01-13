export type IntercomWindow = Window & {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Intercom?: (command: string, ...args: any[]) => void
  intercomSettings: IntercomSettings
}

export type IntercomSettings = Partial<{
  alignment: 'left' | 'right'
  // eslint-disable-next-line @typescript-eslint/naming-convention
  horizontal_padding: number
  // eslint-disable-next-line @typescript-eslint/naming-convention
  vertical_padding: number
}>

export type DefaultProps = {
  data: Record<string, any>
  settings: IntercomSettings
}

export type Props = Partial<DefaultProps> & {
  appId: string
}
