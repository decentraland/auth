import { connection } from 'decentraland-connect'
import { Props, Step } from './SignaturePage.types'
import { ethers } from 'ethers'
import { useState } from 'react'

export const SignaturePage = ({ request, socketRef }: Props) => {
  const [step, setStep] = useState<Step>(Step.WAITING_CLICK_ON_SIGN)

  return (
    <div style={{ margin: '1rem' }}>
      <h1>Sign Data</h1>
      <pre>{request.payload.data}</pre>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          disabled={step !== Step.WAITING_CLICK_ON_SIGN}
          onClick={async () => {
            const provider = await connection.getProvider()
            const browserProvider = new ethers.BrowserProvider(provider)
            const signer = await browserProvider.getSigner()

            setStep(Step.WAITING_WALLET_SIGNATURE)

            const signature = await signer.signMessage(request.payload.data)
            const message = {
              type: 'submit-signature',
              payload: {
                requestId: request.payload.requestId,
                signer: signer.address,
                signature
              }
            }

            socketRef.current?.emit('message', message)

            setStep(Step.SIGNATURE_SUBMITED)
          }}
        >
          Sign
        </button>
        {step === Step.WAITING_WALLET_SIGNATURE ? <div>Sign the message on your wallet...</div> : null}
        {step === Step.SIGNATURE_SUBMITED ? <div>Signature sent to the auth server...</div> : null}
      </div>
    </div>
  )
}
