import { AuthIdentity } from '@dcl/crypto'
import { Events } from '@dcl/schemas'
import signedFetch from 'decentraland-crypto-fetch'
import { config } from '../modules/config'

export interface BlockchainEventPayload {
  type: Events.SubType.Blockchain
  transactionHash: string
}

/**
 * Sends a tip notification to the Events Notifier service via the /forward-blockchain endpoint.
 * Uses ADR-44 signed fetch authentication.
 * @param identity The AuthIdentity of the sender for signed fetch
 * @param transactionHash The transaction hash of the meta-transaction
 * @returns Promise<void>
 */
export async function sendTipNotification(identity: AuthIdentity, transactionHash: string): Promise<void> {
  try {
    const eventsNotifierUrl = config.get('EVENTS_NOTIFIER_URL')

    if (!eventsNotifierUrl) {
      console.warn('EVENTS_NOTIFIER_URL not configured, skipping notification')
      return
    }

    const payload: BlockchainEventPayload = {
      type: Events.SubType.Blockchain.TIP_RECEIVED,
      transactionHash
    }

    const url = `${eventsNotifierUrl}/forward-blockchain`

    console.log('Sending tip notification to:', url, payload)

    const response = await signedFetch(url, {
      method: 'POST',
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      identity
    })

    if (!response.ok) {
      let errorMessage: string
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || `HTTP ${response.status}`
      } catch {
        errorMessage = `HTTP ${response.status} ${response.statusText}`
      }
      console.error(`Failed to send tip notification: ${errorMessage}`)
      console.error('Request details:', { url, method: 'POST', payload })
      throw new Error(`Failed to send tip notification: ${errorMessage}`)
    }

    console.log('Tip notification sent successfully', { transactionHash })
  } catch (error) {
    console.error('Error sending tip notification:', error)
    // Don't throw - we don't want to break the user flow if notification fails
  }
}
