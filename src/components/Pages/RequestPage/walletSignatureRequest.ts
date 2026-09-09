import { Address, Hex } from 'viem'
import { ADDRESS_REGEX, MalformedSignatureRequestError, UnsupportedMethodError } from '../../../shared/auth'
import { RequestClassification } from './classifyRequest'

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
 * Turns a reviewed signature request into the request the wallet is handed: the classification's own
 * bytes — the `hex` a personal_sign review displayed, the `raw` JSON a typed-data review displayed — for
 * the connected signer, under the method the request was recovered with. Nothing is re-derived from the
 * request params, so what the wallet signs is by construction what the screen showed. A method and a
 * classification that do not belong together, or any other method, are refused rather than forwarded.
 */
function toWalletSignatureRequest(method: string, reviewed: RequestClassification, signer: string): WalletSignatureRequest {
  if (!ADDRESS_REGEX.test(signer)) {
    throw new MalformedSignatureRequestError(method, 'the signer is not an address')
  }
  const signerAddress = signer as Address
  switch (method) {
    case 'personal_sign':
      if (reviewed.kind !== 'personal_sign') {
        throw new MalformedSignatureRequestError(method, 'the review is not of a personal_sign message')
      }
      return { method, params: [reviewed.hex as Hex, signerAddress] }
    case 'eth_signTypedData_v3':
      return { method, params: [signerAddress, getReviewedTypedData(method, reviewed)] }
    case 'eth_signTypedData_v4':
      return { method, params: [signerAddress, getReviewedTypedData(method, reviewed)] }
    default:
      throw new UnsupportedMethodError(method)
  }
}

/** The JSON a typed-data review displayed, or a refusal when the review is of something else. */
function getReviewedTypedData(method: string, reviewed: RequestClassification): string {
  if (reviewed.kind !== 'dcl_meta_transaction' && reviewed.kind !== 'unknown_meta_transaction' && reviewed.kind !== 'unknown_typed_data') {
    throw new MalformedSignatureRequestError(method, 'the review is not of typed data')
  }
  return reviewed.raw
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
