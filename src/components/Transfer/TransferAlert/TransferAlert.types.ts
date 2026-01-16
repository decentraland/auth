import { ComponentProps } from 'react'
import { Alert } from 'decentraland-ui2'

export type TransferAlertProps = Omit<ComponentProps<typeof Alert>, 'severity'> & {
  severity?: ComponentProps<typeof Alert>['severity']
  text?: string
}
