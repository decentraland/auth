import { ReactNode } from 'react'

export type TransferLayoutProps = {
  children: ReactNode
  /** Let the screen scroll when its content outgrows the viewport (see Main). */
  scrollable?: boolean
}
