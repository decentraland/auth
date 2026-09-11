import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MenuItem } from 'decentraland-ui2'
import { TransferType } from '../types'
import {
  CloseWindow,
  ConfirmRequestDialog,
  ContinueInApp,
  DeniedWalletInteraction,
  DifferentAccountError,
  LoadingRequest,
  OutdatedClientError,
  RecoverError,
  SignatureRequestView,
  SigningError,
  SimulationSummary,
  TimeoutError,
  TransferCanceledView,
  TransferCompletedView,
  TransferConfirmView,
  UnverifiedRequestView,
  WalletInteraction,
  WalletInteractionComplete
} from '../Views'
import {
  COLLECTION_ADDRESS,
  MANA_CONTRACT_ADDRESS,
  MARKETPLACE_ADDRESS,
  USER_ADDRESS,
  manaData,
  metaTxRaw,
  nftData,
  permitRaw,
  personalSignDigestHex,
  personalSignHex,
  personalSignText,
  simulationNoChanges,
  simulationReverted,
  simulationStablecoinTrade,
  simulationSuccess,
  unclaimedNameAvatar,
  unknownMetaTxRaw
} from './__data__'
import { FloatingBar, PreviewSurface, ViewSelect } from './TestViewPage.styled'

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
      // The consent asked when the recipient had no code at preview time, gated here as RequestPage gates it,
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
      signingErrorUnsupportedContract: {
        label: 'SigningError (call reaches a contract Decentraland does not own, e.g. an ERC-1155 in a trade)',
        element: (
          <SigningError
            kind="unsupported_contract"
            error={
              'The "eth_sendTransaction" request reaches beyond Decentraland\'s contracts: the call reaches a contract that is not Decentraland\'s: 0x76be3b62873462d2142405439777e971754e8e77'
            }
          />
        )
      },
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
      simulationSummarySuccess: {
        label: 'SimulationSummary (Success)',
        element: (
          <PreviewSurface>
            <SimulationSummary simulation={{ status: 'ready', result: simulationSuccess }} userAddress={USER_ADDRESS} chainId={137} />
          </PreviewSurface>
        )
      },
      // A counterparty with a profile name at the length cap, which is where the name and the address it
      // belongs to compete for one line. Shown so the pairing can be looked at, narrow widths included:
      // a name that pushed its address off the row would leave the spoofable half standing alone.
      simulationSummaryLongName: {
        label: 'SimulationSummary (counterparty with a long profile name)',
        element: (
          <PreviewSurface>
            <SimulationSummary
              simulation={{ status: 'ready', result: simulationSuccess }}
              userAddress={USER_ADDRESS}
              chainId={137}
              profiles={{ [MARKETPLACE_ADDRESS.toLowerCase()]: 'Decentraland Marketplace Officia…#8f4d' }}
            />
          </PreviewSurface>
        )
      },
      simulationSummaryReverted: {
        label: 'SimulationSummary (Reverted)',
        element: (
          <PreviewSurface>
            <SimulationSummary simulation={{ status: 'ready', result: simulationReverted }} userAddress={USER_ADDRESS} chainId={137} />
          </PreviewSurface>
        )
      },
      simulationSummaryUnavailable: {
        label: 'SimulationSummary (Unavailable)',
        element: (
          <PreviewSurface>
            <SimulationSummary simulation={{ status: 'unavailable' }} userAddress={USER_ADDRESS} chainId={137} />
          </PreviewSurface>
        )
      },
      simulationSummaryNoChanges: {
        label: 'SimulationSummary (No asset changes)',
        element: (
          <PreviewSurface>
            <SimulationSummary simulation={{ status: 'ready', result: simulationNoChanges }} userAddress={USER_ADDRESS} chainId={137} />
          </PreviewSurface>
        )
      },
      walletInteractionChecking: {
        label: 'Wallet Interaction (Decentraland contract, preview and counterparty check still running)',
        element: (
          <WalletInteraction
            requestId={DEFAULT_REQUEST_ID}
            functionName="accept"
            contractName="Decentraland Marketplace"
            simulation={{ status: 'loading' }}
            userAddress={USER_ADDRESS}
            chainId={137}
            approveBlocked
            gas={{ covered: true }}
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      walletInteractionStablecoinTrade: {
        label: 'Wallet Interaction (trade paying USDT for a wearable)',
        element: (
          <WalletInteraction
            requestId={DEFAULT_REQUEST_ID}
            functionName="accept"
            contractName="Decentraland Marketplace"
            simulation={{ status: 'ready', result: simulationStablecoinTrade }}
            userAddress={USER_ADDRESS}
            verifiedContracts={[MARKETPLACE_ADDRESS]}
            collectionContracts={[COLLECTION_ADDRESS]}
            chainId={137}
            gas={{ covered: true }}
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      walletInteractionSimulation: {
        label: 'Wallet Interaction (Decentraland contract, relayed)',
        element: (
          <WalletInteraction
            requestId={DEFAULT_REQUEST_ID}
            functionName="executeOrder"
            contractName="Decentraland Marketplace"
            simulation={{ status: 'ready', result: simulationSuccess }}
            userAddress={USER_ADDRESS}
            verifiedContracts={[MARKETPLACE_ADDRESS, '0x0f5d2fb29fb7d3cfee444a200298f468908cc942']}
            collectionContracts={[COLLECTION_ADDRESS]}
            chainId={137}
            requiresAcknowledgment
            acknowledged={acknowledged}
            approveBlocked={!acknowledged}
            onAcknowledgedChange={setAcknowledged}
            gas={{ covered: true }}
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      walletInteractionUserPaysGas: {
        label: 'Wallet Interaction (Decentraland contract, user pays gas)',
        element: (
          <WalletInteraction
            requestId={DEFAULT_REQUEST_ID}
            functionName="approve"
            contractName="Decentraland MANA"
            simulation={{ status: 'ready', result: simulationNoChanges }}
            userAddress={USER_ADDRESS}
            chainId={1}
            requiresAcknowledgment
            acknowledged={acknowledged}
            approveBlocked={!acknowledged}
            onAcknowledgedChange={setAcknowledged}
            gas={{ covered: false, status: 'ready', cost: BigInt('2500000000000000'), balance: BigInt('1500000000000000000') }}
            onDeny={noop}
            onApprove={noop}
          />
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
      signatureMetaTx: {
        label: 'SignatureRequest (Decentraland meta-tx)',
        element: (
          <SignatureRequestView
            requestId={DEFAULT_REQUEST_ID}
            method="eth_signTypedData_v4"
            raw={metaTxRaw}
            verifyingContract={MANA_CONTRACT_ADDRESS}
            functionName="transfer"
            contractName="(PoS) Decentraland MANA"
            simulation={{ status: 'ready', result: simulationSuccess }}
            userAddress={USER_ADDRESS}
            chainId={137}
            onDeny={noop}
            onApprove={asyncNoop}
          />
        )
      },
      unverifiedTransaction: {
        label: 'UnverifiedRequest (Unknown transaction)',
        element: (
          <UnverifiedRequestView
            requestId={DEFAULT_REQUEST_ID}
            kind="unknown_transaction"
            method="eth_sendTransaction"
            targetAddress={MARKETPLACE_ADDRESS}
            chainId={137}
            nativeValue="0x0"
            gas={{ status: 'ready', cost: BigInt('4200000000000000') }}
            balance={BigInt('1500000000000000000')}
            payload={{
              kind: 'transaction',
              to: MARKETPLACE_ADDRESS,
              data: '0x095ea7b3000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcdffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
              value: '0x0'
            }}
            approveBlocked={!acknowledged}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      unverifiedNativeTransfer: {
        label: 'UnverifiedRequest (Native transfer)',
        element: (
          <UnverifiedRequestView
            requestId={DEFAULT_REQUEST_ID}
            kind="native_transfer"
            method="eth_sendTransaction"
            targetAddress={USER_ADDRESS}
            targetIsSelf
            chainId={137}
            nativeValue="0x6f05b59d3b20000"
            gas={{ status: 'loading' }}
            balance={BigInt('1500000000000000000')}
            payload={{ kind: 'transaction', to: USER_ADDRESS, data: '0x', value: '0x6f05b59d3b20000' }}
            approveBlocked={!acknowledged}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      unverifiedMetaTransaction: {
        label: 'UnverifiedRequest (Unknown meta-transaction)',
        element: (
          <UnverifiedRequestView
            requestId={DEFAULT_REQUEST_ID}
            kind="unknown_meta_transaction"
            method="eth_signTypedData_v4"
            targetAddress="0xabcdefabcdefabcdefabcdefabcdefabcdefef01"
            chainId={137}
            payload={{ kind: 'typed_data', raw: unknownMetaTxRaw }}
            approveBlocked={!acknowledged}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      unverifiedTypedData: {
        label: 'UnverifiedRequest (Typed data)',
        element: (
          <UnverifiedRequestView
            requestId={DEFAULT_REQUEST_ID}
            kind="unknown_typed_data"
            method="eth_signTypedData_v4"
            payload={{ kind: 'typed_data', raw: permitRaw }}
            approveBlocked={!acknowledged}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      unverifiedPersonalSign: {
        label: 'UnverifiedRequest (personal_sign)',
        element: (
          <UnverifiedRequestView
            requestId={DEFAULT_REQUEST_ID}
            kind="personal_sign"
            method="personal_sign"
            payload={{ kind: 'message', hex: personalSignHex, text: personalSignText }}
            approveBlocked={!acknowledged}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      unverifiedPersonalSignUnreadable: {
        label: 'UnverifiedRequest (personal_sign, unreadable)',
        element: (
          <UnverifiedRequestView
            requestId={DEFAULT_REQUEST_ID}
            kind="personal_sign"
            method="personal_sign"
            payload={{ kind: 'message', hex: personalSignDigestHex, text: null }}
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
