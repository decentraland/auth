import { Address, Hex, stringToHex } from 'viem'
import { ADDRESS_REGEX, MalformedSignatureRequestError, UnsupportedMethodError, isHexBytes } from '../../../shared/auth'

/**
 * A signature request in the exact shape the wallet's EIP-1193 schema gives each method. Modelled as
 * a discriminated union so a method can never be forwarded with another method's parameter shape:
 * adding a signing method here means adding its own member, with its own parameters.
 */
type WalletSignatureRequest =
  | { method: 'personal_sign'; params: [data: Hex, signer: Address] }
  | { method: 'eth_signTypedData_v3'; params: [signer: Address, typedData: string] }
  | { method: 'eth_signTypedData_v4'; params: [signer: Address, typedData: string] }

/** A client whose `request` accepts the wallet EIP-1193 methods this page forwards. */
type SignatureWalletClient = {
  request(args: WalletSignatureRequest): Promise<Hex>
}

/**
 * Turns a recovered signature request into the request the wallet is handed. The recover guard has
 * already pinned the params to the canonical order for each method; this re-checks the shapes it
 * relies on and normalizes the two forms the guard accepts into the one the wallet schema defines:
 * a `personal_sign` message is sent as the bytes it signs — `0x…` hex as those bytes, anything else
 * (plain text, a `0X…` string, the bare `0x`) as the UTF-8 of its characters, decided by the same
 * predicate the classifier displays it with, so the review and the wallet cannot disagree — and typed
 * data handed over as an object is sent as its JSON. Any other method is refused rather than forwarded.
 */
function toWalletSignatureRequest(method: string, params: unknown[] | undefined): WalletSignatureRequest {
  switch (method) {
    case 'personal_sign': {
      const [message, signer] = params ?? []
      if (typeof message !== 'string' || typeof signer !== 'string' || !ADDRESS_REGEX.test(signer)) {
        throw new MalformedSignatureRequestError(method)
      }
      return { method, params: [isHexBytes(message) ? (message.toLowerCase() as Hex) : stringToHex(message), signer as Address] }
    }
    case 'eth_signTypedData_v3':
    case 'eth_signTypedData_v4': {
      const [signer, typedData] = params ?? []
      if (typeof signer !== 'string' || !ADDRESS_REGEX.test(signer) || typedData === undefined || typedData === null) {
        throw new MalformedSignatureRequestError(method)
      }
      const serialized = typeof typedData === 'string' ? typedData : JSON.stringify(typedData)
      return method === 'eth_signTypedData_v3'
        ? { method, params: [signer as Address, serialized] }
        : { method, params: [signer as Address, serialized] }
    }
    default:
      throw new UnsupportedMethodError(method)
  }
}

/** Forwards a signature request to the wallet, one typed call per method. */
function forwardSignatureRequest(walletClient: SignatureWalletClient, request: WalletSignatureRequest): Promise<Hex> {
  switch (request.method) {
    case 'personal_sign':
      return walletClient.request({ method: 'personal_sign', params: request.params })
    case 'eth_signTypedData_v3':
      return walletClient.request({ method: 'eth_signTypedData_v3', params: request.params })
    case 'eth_signTypedData_v4':
      return walletClient.request({ method: 'eth_signTypedData_v4', params: request.params })
  }
}

export { forwardSignatureRequest, toWalletSignatureRequest }
export type { SignatureWalletClient, WalletSignatureRequest }
