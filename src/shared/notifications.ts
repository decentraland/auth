import { NotificationType } from '@dcl/schemas'
import { config } from '../modules/config'

export interface TipNotificationMetadata {
  amount: string
  senderAddress: string
  receiverAddress: string
}

export interface NotificationPayload {
  type: NotificationType
  address: string
  eventKey: string
  metadata: TipNotificationMetadata
  timestamp: number
}

/**
 * Sends a tip notification to the notifications service
 * @param senderAddress The address of the sender (tipper)
 * @param receiverAddress The address of the receiver
 * @param amount The amount of MANA tipped
 * @param transactionHash The transaction hash to use as the event key
 * @returns Promise<void>
 */
export async function sendTipNotification(
  senderAddress: string,
  receiverAddress: string,
  amount: string,
  transactionHash: string
): Promise<void> {
  try {
    // TODO: we should change this logic to use the AUTH_SERVER_URL
    const notificationsProcessorUrl = config.get('NOTIFICATIONS_PROCESSOR_URL')
    const notificationsProcessorToken = config.get('NOTIFICATIONS_PROCESSOR_TOKEN')

    if (!notificationsProcessorUrl) {
      console.warn('NOTIFICATIONS_PROCESSOR_URL not configured, skipping notification')
      return
    }

    if (!notificationsProcessorToken) {
      console.warn('NOTIFICATIONS_PROCESSOR_TOKEN not configured, skipping notification')
      return
    }

    const notification: NotificationPayload = {
      type: NotificationType.TIP_RECEIVED,
      address: receiverAddress.toLowerCase(),
      eventKey: `tip-${transactionHash}`,
      metadata: {
        amount,
        senderAddress: senderAddress.toLowerCase(),
        receiverAddress: receiverAddress.toLowerCase()
      },
      timestamp: Date.now()
    }

    const processorUrl = `${notificationsProcessorUrl}/notifications`

    console.log('Sending tip notification to:', processorUrl, {
      type: notification.type,
      address: notification.address,
      eventKey: notification.eventKey
    })

    const response = await fetch(processorUrl, {
      method: 'POST',
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'Content-Type': 'application/json',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Authorization: `Bearer ${notificationsProcessorToken}`
      },
      body: JSON.stringify([notification])
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Failed to send tip notification: ${response.status} ${response.statusText}`, errorText)
      console.error('Request details:', {
        url: processorUrl,
        method: 'POST',
        hasToken: !!notificationsProcessorToken,
        payload: notification
      })
      throw new Error(`Failed to send tip notification: ${response.status}`)
    }

    console.log('Tip notification sent successfully', { senderAddress, receiverAddress, amount, transactionHash })
  } catch (error) {
    console.error('Error sending tip notification:', error)
    // Don't throw - we don't want to break the user flow if notification fails
  }
}
