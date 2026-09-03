import { SimulationRequestBody } from './types'

/**
 * Builds the simulation of a Decentraland meta-transaction's inner call the way the contract will
 * make it.
 *
 * `executeMetaTransaction` verifies the signature and then calls ITSELF with the calldata plus the
 * user's address appended — `abi.encodePacked(calldata, user)` — and `_msgSender()` reads that
 * trailing address because `msg.sender` is the contract. Simulating the user calling the contract
 * directly agrees with that only where the code consults `_msgSender()`; anything reading raw
 * `msg.sender`, gating on a self-call, or measuring the calldata would preview one thing and
 * execute another. The value is zero because the relay never forwards any.
 *
 * `userAddress` must be the connected signer: a valid meta-transaction is authorized by (and
 * executed for) the signer, so any other address in the request is only an attempt to make the
 * preview attribute the effects to someone else.
 */
function buildMetaTransactionSimulationPayload(
  chainId: number,
  contractAddress: string,
  calldata: string,
  userAddress: string
): SimulationRequestBody {
  const appendedUser = (userAddress.startsWith('0x') ? userAddress.slice(2) : userAddress).toLowerCase()
  return {
    chainId,
    from: contractAddress,
    to: contractAddress,
    data: `${calldata}${appendedUser}`,
    value: '0'
  }
}

export { buildMetaTransactionSimulationPayload }
