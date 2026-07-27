import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MenuItem } from 'decentraland-ui2'
import { TransferType } from '../types'
import {
  CloseWindow,
  ContinueInApp,
  DeniedWalletInteraction,
  DifferentAccountError,
  IpValidationError,
  LoadingRequest,
  OutdatedClientError,
  RecoverError,
  SignatureRequestView,
  SigningError,
  SimulationSummary,
  TimeoutError,
  TransactionConfirmDialog,
  TransferCanceledView,
  TransferCompletedView,
  TransferConfirmView,
  WalletInteraction,
  WalletInteractionComplete
} from '../Views'
import {
  USER_ADDRESS,
  manaData,
  messageSignaturePayload,
  metaTxSignaturePayload,
  nftData,
  simulationNoChanges,
  simulationReverted,
  simulationSuccess,
  typedDataSignaturePayload
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
      ipValidationError: { label: 'IpValidationError', element: <IpValidationError requestId={DEFAULT_REQUEST_ID} reason="Test reason" /> },
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
      walletInteraction: {
        label: 'Wallet Interaction',
        element: <WalletInteraction requestId={DEFAULT_REQUEST_ID} onDeny={noop} onApprove={noop} />
      },
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
        label: 'Wallet Interaction (with summary)',
        element: (
          <WalletInteraction
            requestId={DEFAULT_REQUEST_ID}
            isWeb2Wallet
            simulation={{ status: 'ready', result: simulationSuccess }}
            userAddress={USER_ADDRESS}
            verifiedContracts={['0x1234567890abcdef1234567890abcdef12345678', '0x0f5d2fb29fb7d3cfee444a200298f468908cc942']}
            chainId={137}
            requiresAcknowledgment
            gasCovered
            onDeny={noop}
            onApprove={noop}
          />
        )
      },
      transactionDialogGasCovered: {
        label: 'TransactionConfirmDialog (Gas covered)',
        element: (
          <TransactionConfirmDialog open transactionCost={BigInt(0)} balance={BigInt(0)} gasCovered onCancel={noop} onConfirm={noop} />
        )
      },
      transactionDialogWithGas: {
        label: 'TransactionConfirmDialog (User pays gas)',
        element: (
          <TransactionConfirmDialog
            open
            transactionCost={BigInt('2500000000000000')}
            balance={BigInt('1500000000000000000')}
            onCancel={noop}
            onConfirm={noop}
          />
        )
      },
      transactionDialogReverted: {
        label: 'TransactionConfirmDialog (Reverted)',
        element: (
          <TransactionConfirmDialog
            open
            transactionCost={BigInt('2500000000000000')}
            balance={BigInt('1500000000000000000')}
            isReverted
            onCancel={noop}
            onConfirm={noop}
          />
        )
      },
      signatureMessage: {
        label: 'SignatureRequest (Message)',
        element: (
          <SignatureRequestView
            requestId={DEFAULT_REQUEST_ID}
            method="personal_sign"
            payload={messageSignaturePayload}
            simulation={{ status: 'idle' }}
            userAddress={USER_ADDRESS}
            isMetaTransaction={false}
            onDeny={noop}
            onApprove={asyncNoop}
          />
        )
      },
      signatureTypedData: {
        label: 'SignatureRequest (Typed Data)',
        element: (
          <SignatureRequestView
            requestId={DEFAULT_REQUEST_ID}
            method="eth_signTypedData_v4"
            payload={typedDataSignaturePayload}
            simulation={{ status: 'idle' }}
            userAddress={USER_ADDRESS}
            isMetaTransaction={false}
            onDeny={noop}
            onApprove={asyncNoop}
          />
        )
      },
      signatureMetaTx: {
        label: 'SignatureRequest (Meta-tx)',
        element: (
          <SignatureRequestView
            requestId={DEFAULT_REQUEST_ID}
            method="eth_signTypedData_v4"
            payload={metaTxSignaturePayload}
            simulation={{ status: 'ready', result: simulationSuccess }}
            userAddress={USER_ADDRESS}
            isMetaTransaction={true}
            onDeny={noop}
            onApprove={asyncNoop}
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
