type IntercomWindow = Window & {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Intercom?: (command: string, ...args: unknown[]) => void
  intercomSettings: IntercomSettings
}

type IntercomSettings = Partial<{
  alignment: 'left' | 'right'
  // eslint-disable-next-line @typescript-eslint/naming-convention
  horizontal_padding: number
  // eslint-disable-next-line @typescript-eslint/naming-convention
  vertical_padding: number
}>

type DefaultProps = {
  data: Record<string, unknown>
  settings: IntercomSettings
}

type Props = Partial<DefaultProps> & {
  appId: string
}

export type { IntercomWindow, IntercomSettings, DefaultProps, Props }
