import { useMemo } from 'react'
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
  simulationSuccess,
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
          <TransferConfirmView type={TransferType.GIFT} transferData={nftData} isLoading={false} onDeny={noop} onApprove={asyncNoop} />
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
          <TransferConfirmView type={TransferType.GIFT} transferData={nftData} isLoading={false} onDeny={noop} onApprove={asyncNoop} />
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
            chainId={137}
            requiresAcknowledgment
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
            payloadFingerprint="unknown-transaction"
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
            payloadFingerprint="native-transfer"
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
            payloadFingerprint="unknown-meta-tx"
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
            payloadFingerprint="permit"
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
            payloadFingerprint={personalSignHex}
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
            payloadFingerprint={personalSignDigestHex}
            onDeny={noop}
            onApprove={noop}
          />
        )
      }
    } as const
  }, [])

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
