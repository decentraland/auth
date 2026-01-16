import { ComponentProps } from 'react'
import { Profile } from 'decentraland-ui2'

export type TransferProfileProps = ComponentProps<typeof Profile> & {
  withContainer?: boolean
}
