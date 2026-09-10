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
 *
 * What this preview cannot reproduce: on chain the relayer's account is `tx.origin`, gas is paid at
 * a real price and the contract's nonce for the user has already moved, while the preview runs from
 * the contract itself at a zero gas price with the nonce untouched. A marketplace's custom external
 * check can read getNonce even on a Decentraland contract, so collectCallAddresses refuses custom
 * checks as well as unreadable nested calls. Code outside Decentraland's contracts (a recipient's
 * ERC-721 callback) can distinguish these contexts too, so the page also checks the contracts the
 * call reaches (see getCounterpartyAddresses in the request page utils).
 */
function buildMetaTransactionSimulationPayload(
  chainId: number,
  contractAddress: string,
  calldata: string,
  userAddress: string
): SimulationRequestBody {
  // Lowercase first so a `0X` prefix is stripped too; the relay appends the bare 20-byte address.
  const normalizedUser = userAddress.toLowerCase()
  const appendedUser = normalizedUser.startsWith('0x') ? normalizedUser.slice(2) : normalizedUser
  return {
    chainId,
    from: contractAddress,
    to: contractAddress,
    data: `${calldata}${appendedUser}`,
    value: '0'
  }
}

export { buildMetaTransactionSimulationPayload }
