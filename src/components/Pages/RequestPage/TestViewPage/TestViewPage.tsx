import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, MenuItem, muiIcons } from 'decentraland-ui2'
import { Container } from '../Container'
import { ButtonsContainer, NoButton, VerificationCode, YesButton } from '../RequestPage.styled'
import { TransferType } from '../types'
import {
  CloseWindow,
  ContinueInApp,
  DeniedSignIn,
  DeniedWalletInteraction,
  DifferentAccountError,
  IpValidationError,
  RecoverError,
  SignInComplete,
  SigningError,
  TimeoutError,
  TransferCanceledView,
  TransferCompletedView,
  TransferConfirmView,
  WalletInteractionComplete
} from '../Views'
import viewStyles from '../Views/Views.module.css'
import { manaData, nftData } from './__data__'
import { FloatingBar, ViewSelect } from './TestViewPage.styled'

const CancelIcon = muiIcons.Cancel
const CheckCircleIcon = muiIcons.CheckCircle

type ViewIdParam = {
  viewId?: string
}

const DEFAULT_REQUEST_ID = 'test-request-id'

export const TestViewPage = () => {
  const navigate = useNavigate()
  const { viewId } = useParams<ViewIdParam>()

  const views = useMemo(() => {
    return {
      closeWindow: { label: 'CloseWindow', element: <CloseWindow /> },
      continueInApp: {
        label: 'ContinueInApp',
        element: (
          <ContinueInApp autoStart={false} onContinue={() => undefined} requestId={DEFAULT_REQUEST_ID} deepLinkUrl="decentraland://" />
        )
      },
      deniedSignIn: { label: 'DeniedSignIn', element: <DeniedSignIn requestId={DEFAULT_REQUEST_ID} /> },
      deniedWalletInteraction: { label: 'DeniedWalletInteraction', element: <DeniedWalletInteraction /> },
      differentAccountError: { label: 'DifferentAccountError', element: <DifferentAccountError requestId={DEFAULT_REQUEST_ID} /> },
      ipValidationError: { label: 'IpValidationError', element: <IpValidationError requestId={DEFAULT_REQUEST_ID} reason="Test reason" /> },
      manaTransfer: {
        label: 'TransferConfirmView (Tip)',
        element: (
          <TransferConfirmView
            type={TransferType.TIP}
            transferData={manaData}
            isLoading={false}
            onDeny={() => undefined}
            onApprove={async () => undefined}
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
            onDeny={() => undefined}
            onApprove={async () => undefined}
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
      recoverError: { label: 'RecoverError', element: <RecoverError error="Test error" /> },
      signingError: { label: 'SigningError', element: <SigningError error="Test error" /> },
      signInComplete: { label: 'SignInComplete', element: <SignInComplete /> },
      timeoutError: { label: 'TimeoutError', element: <TimeoutError requestId={DEFAULT_REQUEST_ID} /> },
      verifySignIn: {
        label: 'Verify Sign In',
        element: (
          <Container canChangeAccount requestId={DEFAULT_REQUEST_ID}>
            <div className={viewStyles.logo}></div>
            <div className={viewStyles.title}>Verify Sign In</div>
            <div className={viewStyles.description}>Does the verification number below match the one in the Explorer?</div>
            <VerificationCode>1234</VerificationCode>
            <ButtonsContainer>
              <NoButton variant="outlined" startIcon={<CancelIcon />}>
                No, it doesn&apos;t
              </NoButton>
              <YesButton variant="outlined" startIcon={<CheckCircleIcon />}>
                Yes, they are the same
              </YesButton>
            </ButtonsContainer>
          </Container>
        )
      },
      walletInteraction: {
        label: 'Wallet Interaction',
        element: (
          <Container canChangeAccount requestId={DEFAULT_REQUEST_ID}>
            <div className={viewStyles.logo}></div>
            <div className={viewStyles.title}>The Explorer wants to interact with your wallet</div>
            <div className={viewStyles.description}>Only proceed if you are aware of all transaction details and trust this scene.</div>
            <ButtonsContainer>
              <Button variant="outlined">Deny</Button>
              <Button variant="contained">Allow</Button>
            </ButtonsContainer>
          </Container>
        )
      },
      walletInteractionComplete: { label: 'WalletInteractionComplete', element: <WalletInteractionComplete /> },
      walletNftInteraction: {
        label: 'Wallet NFT Interaction',
        element: (
          <TransferConfirmView
            type={TransferType.GIFT}
            transferData={nftData}
            isLoading={false}
            onDeny={() => undefined}
            onApprove={async () => undefined}
          />
        )
      },
      walletManaInteraction: {
        label: 'Wallet MANA Interaction',
        element: (
          <TransferConfirmView
            type={TransferType.TIP}
            transferData={manaData}
            isLoading={false}
            onDeny={() => undefined}
            onApprove={async () => undefined}
          />
        )
      }
    } as const
  }, [manaData, nftData])

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
