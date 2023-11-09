import { useCallback, useState } from 'react'
import { BrowserProvider, formatEther } from 'ethers'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { connection } from 'decentraland-connect'

export function isErrorWithMessage(error: unknown): error is Error {
  return error !== undefined && error !== null && typeof error === 'object' && 'message' in error
}

export const UserPage = () => {
  const [balance, setBalance] = useState<string>()
  const [balanceError, setBalanceError] = useState<string>()
  const [signatureError, setSignatureError] = useState<string>()
  const [singedMessage, setSignedMessage] = useState<string>()
  const handleSign = useCallback(async () => {
    setSignatureError(undefined)
    setSignedMessage(undefined)
    try {
      const connectionData = await connection.tryPreviousConnection()
      const provider = new BrowserProvider(connectionData.provider)
      const signer = await provider.getSigner()
      const message = await signer.signMessage('Hello world')
      setSignedMessage(message)
    } catch (error) {
      setSignatureError(isErrorWithMessage(error) ? error.message : 'Unknown error')
    }
  }, [])

  const handleGetBalance = useCallback(async () => {
    setBalanceError(undefined)
    setBalance(undefined)
    try {
      const connectionData = await connection.tryPreviousConnection()
      const provider = new BrowserProvider(connectionData.provider)
      const balance = await provider.getBalance(connectionData.account ?? '')
      setBalance(formatEther(balance))
    } catch (error) {
      setBalanceError(isErrorWithMessage(error) ? error.message : 'Unknown error')
    }
  }, [])

  return (
    <div>
      <h1>This is a simple test page</h1>
      <div>
        <p>Sign message test</p>
        <Button primary size="small" onClick={handleSign}>
          Sign message
        </Button>
        {singedMessage ? <p>Signed message: {singedMessage}</p> : null}
        {signatureError ? <p>Error: {signatureError}</p> : null}
      </div>
      <div>
        <br></br>
        <p>Get balance test</p>
        <Button primary size="small" onClick={handleGetBalance}>
          Get balance
        </Button>
        {balance ? <p>Balance: {balance}</p> : null}
        {balanceError ? <p>Error: {balanceError}</p> : null}
      </div>
    </div>
  )
}
