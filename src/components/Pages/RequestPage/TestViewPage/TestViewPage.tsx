import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MenuItem } from 'decentraland-ui2'
import { TransferType } from '../types'
import {
  ActionRequestView,
  CloseWindow,
  ConfirmRequestDialog,
  ContinueInApp,
  DeniedWalletInteraction,
  DifferentAccountError,
  LoadingRequest,
  OutdatedClientError,
  RecoverError,
  SigningError,
  TimeoutError,
  TransferCanceledView,
  TransferCompletedView,
  TransferConfirmView,
  WalletInteractionComplete
} from '../Views'
import {
  MARKETPLACE_ADDRESS,
  USER_ADDRESS,
  executeOrderData,
  manaData,
  metaTxRaw,
  nftData,
  permitRaw,
  personalSignDigestHex,
  personalSignHex,
  personalSignText,
  unclaimedNameAvatar
} from './__data__'
import { FloatingBar, ViewSelect } from './TestViewPage.styled'

type ViewIdParam = {
  viewId?: string
}

const DEFAULT_REQUEST_ID = 'test-request-id'
const noop = () => undefined
const asyncNoop = async () => undefined

export const TestViewPage = () => {
  // Every screen that asks for an acknowledgment is gated on it here, the way RequestPage gates it (see
  // isReviewActionable). Without this the checkbox would be inert and Allow frozen, so these screens would
  // not behave as they do in the app — which is the whole point of rendering them.
  const [acknowledged, setAcknowledged] = useState(false)
  const navigate = useNavigate()
  const { viewId } = useParams<ViewIdParam>()

  const views = useMemo(() => {
    return {
      closeWindow: { label: 'CloseWindow', element: <CloseWindow /> },
      continueInApp: {
        label: 'ContinueInApp',
        element: <ContinueInApp autoStart={false} onContinue={noop} requestId={DEFAULT_REQUEST_ID} deepLinkUrl="decentraland://" />
      },
      deniedWalletInteraction: { label: 'DeniedWalletInteraction', element: <DeniedWalletInteraction /> },
      differentAccountError: { label: 'DifferentAccountError', element: <DifferentAccountError requestId={DEFAULT_REQUEST_ID} /> },
      loadingRequest: { label: 'LoadingRequest', element: <LoadingRequest /> },
      manaTransfer: {
        label: 'TransferConfirmView (Tip)',
        element: (
          <TransferConfirmView type={TransferType.TIP} transferData={manaData} isLoading={false} onDeny={noop} onApprove={asyncNoop} />
        )
      },
      // The same screen for a place that is a world: addressed by a NAME its deployer owns, so the name is
      // what locates it and its base position says nothing (see getPlaceLocation).
      manaTransferWorld: {
        label: 'TransferConfirmView (Tip, place is a world)',
        element: (
          <TransferConfirmView
            type={TransferType.TIP}
            transferData={{ ...manaData, sceneLocation: { kind: 'world', name: 'flagtag.dcl.eth' } }}
            isLoading={false}
            onDeny={noop}
            onApprove={asyncNoop}
          />
        )
      },
      manaTransferCanceled: {
        label: 'TransferCanceledView (Tip)',
        element: <TransferCanceledView type={TransferType.TIP} transferData={manaData} />
      },
      manaTransferComplete: {
        label: 'TransferCompletedView (Tip)',
        element: <TransferCompletedView type={TransferType.TIP} transferData={manaData} />
      },
      nftTransfer: {
        label: 'TransferConfirmView (Gift)',
        element: (
          <TransferConfirmView
            type={TransferType.GIFT}
            transferData={nftData}
            isLoading={false}
            chainId={137}
            onDeny={noop}
            onApprove={asyncNoop}
          />
        )
      },
      // The consent asked when the recipient had no code at review time, gated here as RequestPage gates it,
      // so the e2e suite can measure that the notices, the checkbox and the buttons stack without overlapping.
      transferConfirmGiftCallbackConsent: {
        label: 'TransferConfirmView (Gift, recipient without code — asks the delayed-code consent)',
        element: (
          <TransferConfirmView
            type={TransferType.GIFT}
            transferData={nftData}
            isLoading={false}
            chainId={137}
            callbackAddresses={[nftData.toAddress]}
            callbackAcknowledged={acknowledged}
            approveBlocked={!acknowledged}
            onCallbackAcknowledgedChange={setAcknowledged}
            onDeny={noop}
            onApprove={asyncNoop}
          />
        )
      },
      transferConfirmTipCallbackConsent: {
        label: 'TransferConfirmView (Tip, recipient without code — asks the delayed-code consent)',
        element: (
          <TransferConfirmView
            type={TransferType.TIP}
            transferData={manaData}
            isLoading={false}
            callbackAddresses={[manaData.toAddress]}
            callbackAcknowledged={acknowledged}
            approveBlocked={!acknowledged}
            onCallbackAcknowledgedChange={setAcknowledged}
            onDeny={noop}
            onApprove={asyncNoop}
          />
        )
      },
      // The gift confirmation for a recipient whose name is not claimed: the name is free to copy and Profile
      // disambiguates it only by the last four characters of the address, so this is the screen where naming
      // the address matters (see TransferConfirmView).
      nftTransferUnclaimedName: {
        label: 'TransferConfirmView (Gift, recipient with an unclaimed name)',
        element: (
          <TransferConfirmView
            type={TransferType.GIFT}
            transferData={{ ...nftData, recipientProfile: { avatars: [unclaimedNameAvatar] } }}
            isLoading={false}
            chainId={137}
            onDeny={noop}
            onApprove={asyncNoop}
          />
        )
      },
      nftTransferCanceled: {
        label: 'TransferCanceledView (Gift)',
        element: <TransferCanceledView type={TransferType.GIFT} transferData={nftData} />
      },
      nftTransferComplete: {
        label: 'TransferCompletedView (Gift)',
        element: <TransferCompletedView type={TransferType.GIFT} transferData={nftData} />
      },
      outdatedClientError: { label: 'OutdatedClientError', element: <OutdatedClientError explorerText="Explorer" /> },
      recoverError: { label: 'RecoverError', element: <RecoverError onTryAgain={() => alert('try again')} /> },
      signingError: { label: 'SigningError', element: <SigningError error="Test error" /> },
      timeoutError: { label: 'TimeoutError', element: <TimeoutError requestId={DEFAULT_REQUEST_ID} /> },
      walletInteractionComplete: { label: 'WalletInteractionComplete', element: <WalletInteractionComplete /> },
      walletNftInteraction: {
        label: 'Wallet NFT Interaction',
        element: (
          <TransferConfirmView
            type={TransferType.GIFT}
            transferData={nftData}
            isLoading={false}
            chainId={137}
            onDeny={noop}
            onApprove={asyncNoop}
          />
        )
      },
      walletManaInteraction: {
        label: 'Wallet MANA Interaction',
        element: (
          <TransferConfirmView type={TransferType.TIP} transferData={manaData} isLoading={false} onDeny={noop} onApprove={asyncNoop} />
        )
      },
      confirmRequestGasCovered: {
        label: 'ConfirmRequestDialog (Transaction, gas covered)',
        element: <ConfirmRequestDialog open kind="transaction" gas={{ covered: true }} onCancel={noop} onConfirm={noop} />
      },
      confirmRequestUserPaysGas: {
        label: 'ConfirmRequestDialog (Transaction, user pays gas)',
        element: (
          <ConfirmRequestDialog
            open
            kind="transaction"
            gas={{ covered: false, status: 'ready', cost: BigInt('4200000000000000'), chainId: 137 }}
            onCancel={noop}
            onConfirm={noop}
          />
        )
      },
      confirmRequestSignature: {
        label: 'ConfirmRequestDialog (Signature)',
        element: <ConfirmRequestDialog open kind="signature" onCancel={noop} onConfirm={noop} />
      },
      // The generic review: everything that is not a tip or a gift lands here, whatever it targets.
      actionTransaction: {
        label: 'ActionRequest (transaction)',
        element: (
          <ActionRequestView
            requestId={DEFAULT_REQUEST_ID}
            payload={{ kind: 'transaction', to: MARKETPLACE_ADDRESS, data: executeOrderData, value: '0x0', chainId: 137 }}
            approveBlocked={!acknowledged}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      // Gas covered by Decentraland: the wallet is asked to sign a meta-transaction wrapping this call, so
      // the block is worded as the action rather than as the bytes the wallet receives.
      actionRelayedTransaction: {
        label: 'ActionRequest (transaction relayed by Decentraland)',
        element: (
          <ActionRequestView
            requestId={DEFAULT_REQUEST_ID}
            payload={{ kind: 'transaction', to: MARKETPLACE_ADDRESS, data: executeOrderData, value: '0x0', chainId: 137, relayed: true }}
            approveBlocked={!acknowledged}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      actionNativeTransfer: {
        label: 'ActionRequest (plain value transfer)',
        element: (
          <ActionRequestView
            requestId={DEFAULT_REQUEST_ID}
            payload={{ kind: 'transaction', to: USER_ADDRESS, data: '0x', value: '0x6f05b59d3b20000', chainId: 137 }}
            approveBlocked={!acknowledged}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      actionMetaTransaction: {
        label: 'ActionRequest (Decentraland meta-transaction signature)',
        element: (
          <ActionRequestView
            requestId={DEFAULT_REQUEST_ID}
            payload={{ kind: 'typed_data', raw: metaTxRaw }}
            approveBlocked={!acknowledged}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      actionTypedData: {
        label: 'ActionRequest (typed data, a USDC permit)',
        element: (
          <ActionRequestView
            requestId={DEFAULT_REQUEST_ID}
            payload={{ kind: 'typed_data', raw: permitRaw }}
            approveBlocked={!acknowledged}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      actionPersonalSign: {
        label: 'ActionRequest (personal_sign)',
        element: (
          <ActionRequestView
            requestId={DEFAULT_REQUEST_ID}
            payload={{ kind: 'message', hex: personalSignHex, text: personalSignText }}
            approveBlocked={!acknowledged}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      actionPersonalSignUnreadable: {
        label: 'ActionRequest (personal_sign, bytes that are not text)',
        element: (
          <ActionRequestView
            requestId={DEFAULT_REQUEST_ID}
            payload={{ kind: 'message', hex: personalSignDigestHex, text: null }}
            approveBlocked={!acknowledged}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      actionRestarted: {
        label: 'ActionRequest (review restarted after a network change)',
        element: (
          <ActionRequestView
            requestId={DEFAULT_REQUEST_ID}
            payload={{ kind: 'transaction', to: MARKETPLACE_ADDRESS, data: executeOrderData, value: '0x0', chainId: 137 }}
            reviewRestarted
            approveBlocked={!acknowledged}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            onDeny={noop}
            onApprove={noop}
          />
        )
      }
    } as const
  }, [acknowledged])

  const selected = viewId ? (views as Record<string, { label: string; element: JSX.Element }>)[viewId] : undefined

  return (
    <>
      <FloatingBar>
        <ViewSelect select label="View" size="small" value={viewId ?? ''} onChange={event => navigate(`/testView/${event.target.value}`)}>
          <MenuItem value="">Select a view…</MenuItem>
          {Object.entries(views).map(([id, { label }]) => (
            <MenuItem key={id} value={id}>
              {label}
            </MenuItem>
          ))}
        </ViewSelect>
      </FloatingBar>
      {selected ? selected.element : null}
    </>
  )
}
