import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Rarity } from '@dcl/schemas'
import { DclThemeProvider, darkTheme } from 'decentraland-ui2'
import { TransferType } from '../../../types'
import type { MANATransferData, NFTTransferData } from '../../../types'
import { TransferConfirmView } from './TransferConfirmView'
import { TransferConfirmViewProps } from './TransferConfirmView.types'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({
    // Values are rendered too, so a test can assert that what the copy interpolates is what reaches it.
    t: (key: string, values?: Record<string, string | number>) => (values ? `${key} ${JSON.stringify(values)}` : key)
  })
}))

// TransferLayout renders the WebGL AnimatedBackground, which jsdom can't run.
jest.mock('../../../../../AnimatedBackground', () => ({
  AnimatedBackground: () => null
}))

// Profile reads the Decentraland theme, and it is rendered for real here: who the transfer goes to is what
// this screen exists to state, so what it actually says has to be asserted rather than stubbed away.
const renderView = (viewProps: TransferConfirmViewProps) =>
  render(
    <DclThemeProvider theme={darkTheme}>
      <TransferConfirmView {...viewProps} />
    </DclThemeProvider>
  )

describe('when confirming a branded transfer', () => {
  let props: TransferConfirmViewProps
  let onApprove: jest.Mock
  let onDeny: jest.Mock
  let onCallbackAcknowledgedChange: jest.Mock
  let transferData: MANATransferData

  beforeEach(() => {
    onApprove = jest.fn()
    onDeny = jest.fn()
    onCallbackAcknowledgedChange = jest.fn()
    transferData = {
      manaAmount: '10 MANA',
      toAddress: '0x1234567890abcdef1234567890abcdef12345678',
      sceneName: 'Genesis Plaza',
      sceneImageUrl: 'https://example.com/scene.png'
    }
    props = { type: TransferType.TIP, transferData, isLoading: false, onApprove, onDeny, onCallbackAcknowledgedChange }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and the approval hands the user to a wallet prompt that is still open', () => {
    let resolveApproval: () => void

    beforeEach(() => {
      onApprove.mockImplementation(
        () =>
          new Promise<void>(resolve => {
            resolveApproval = resolve
          })
      )
    })

    it('should show the processing state instead of the buttons while the prompt is open', async () => {
      renderView(props)
      await userEvent.click(screen.getByTestId('transfer-confirm-button'))
      expect(screen.queryByTestId('transfer-confirm-button')).not.toBeInTheDocument()
      expect(screen.getByText('transfer.confirm.processing_authorization')).toBeInTheDocument()
      await act(async () => resolveApproval())
    })
  })

  describe('and the approval only opened a confirmation dialog the user then cancelled', () => {
    beforeEach(() => {
      onApprove.mockResolvedValue(undefined)
    })

    it('should hand the buttons back so the user can still deny or confirm', async () => {
      renderView(props)
      await userEvent.click(screen.getByTestId('transfer-confirm-button'))
      expect(screen.getByTestId('transfer-confirm-button')).toBeInTheDocument()
      expect(screen.getByTestId('transfer-cancel-button')).toBeInTheDocument()
    })
  })

  describe('and the page is executing the confirmed request', () => {
    beforeEach(() => {
      props = { ...props, isLoading: true }
    })

    it('should show the processing state', () => {
      renderView(props)
      expect(screen.getByText('transfer.confirm.processing_authorization')).toBeInTheDocument()
      expect(screen.queryByTestId('transfer-confirm-button')).not.toBeInTheDocument()
    })
  })

  describe('and a called address had no code during the preview', () => {
    beforeEach(() => {
      props = { ...props, callbackAddresses: ['0x1234567890abcdef1234567890abcdef12345678'] }
    })

    it('should warn that code can appear before execution', () => {
      renderView(props)
      expect(screen.getByTestId('callback-code-warning')).toHaveTextContent('request.transaction_dialog.callback_code_notice')
    })

    it('should report callback consent to the page', async () => {
      renderView(props)
      await userEvent.click(screen.getByRole('checkbox', { name: 'request.transaction_dialog.acknowledge_callback_code' }))
      expect(onCallbackAcknowledgedChange).toHaveBeenCalledWith(true)
    })

    // jsdom lays nothing out, so the geometry itself is checked in the browser (see the e2e suite). What can
    // be checked here is the cause: a notice with a negative bottom margin drags whatever follows it up over
    // itself, and the checkbox follows its warning.
    it('should lay the warning and its checkbox out in one group, with no notice pulling the next one over it', () => {
      renderView(props)
      const group = screen.getByTestId('transfer-notices')
      const warning = screen.getByTestId('callback-code-warning')
      const checkbox = screen.getByRole('checkbox', { name: 'request.transaction_dialog.acknowledge_callback_code' })
      expect(group).toContainElement(warning)
      expect(group).toContainElement(checkbox)
      for (const notice of Array.from(group.children)) {
        expect(parseFloat(getComputedStyle(notice).marginBottom || '0')).toBeGreaterThanOrEqual(0)
      }
    })

    describe('and the transfer is a gift, which carries a notice of its own', () => {
      beforeEach(() => {
        const nftData: NFTTransferData = {
          imageUrl: 'https://example.com/nft.png',
          tokenId: '1',
          toAddress: transferData.toAddress,
          contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          name: 'Hat',
          description: 'A hat',
          rarity: Rarity.COMMON
        }
        props = { ...props, type: TransferType.GIFT, transferData: nftData }
      })

      it('should keep both notices and the checkbox in the group, none pulling the next over it', () => {
        renderView(props)
        const group = screen.getByTestId('transfer-notices')
        expect(group).toContainElement(screen.getByTestId('gifting-warning'))
        expect(group).toContainElement(screen.getByTestId('callback-code-warning'))
        expect(group).toContainElement(screen.getByRole('checkbox', { name: 'request.transaction_dialog.acknowledge_callback_code' }))
        for (const notice of Array.from(group.children)) {
          expect(parseFloat(getComputedStyle(notice).marginBottom || '0')).toBeGreaterThanOrEqual(0)
        }
      })
    })
  })

  // A display name is not an identity. Only a claimed name is unique; an unclaimed one is free to copy, and
  // Profile disambiguates it with the last four characters of the address — 65,536 of which exist, so a
  // vanity address is enough to make an attacker's account read exactly like the intended recipient's. The
  // screen must therefore also say which address the NFT is being sent to.
  describe('and the transfer is a gift', () => {
    const INTENDED = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa5678'
    const IMPERSONATOR = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb5678'

    const giftTo = (toAddress: string, avatar?: { name: string; hasClaimedName: boolean }): TransferConfirmViewProps => ({
      type: TransferType.GIFT,
      transferData: {
        imageUrl: 'https://example.com/nft.png',
        tokenId: '1',
        toAddress,
        contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        name: 'Hat',
        description: 'A hat',
        rarity: Rarity.COMMON,
        recipientProfile: avatar ? ({ avatars: [avatar] } as NFTTransferData['recipientProfile']) : undefined
      },
      isLoading: false,
      onApprove,
      onDeny
    })

    describe('and the recipient has a name they have not claimed', () => {
      it('should show the address it is being sent to alongside that name', () => {
        renderView(giftTo(INTENDED, { name: 'Alice', hasClaimedName: false }))

        expect(screen.getByText('Alice#5678')).toBeInTheDocument()
        expect(screen.getByText('0xaaaa\u20265678')).toBeInTheDocument()
      })

      it('should offer the full address to copy, so it can be checked rather than trusted', async () => {
        renderView(giftTo(INTENDED, { name: 'Alice', hasClaimedName: false }))
        const writeText = jest.fn()
        Object.assign(navigator, { clipboard: { writeText } })

        await userEvent.click(screen.getByLabelText('Copy address'))

        expect(writeText).toHaveBeenCalledWith(INTENDED)
      })

      it('should read differently for another account wearing the same name and address ending', () => {
        const { unmount } = renderView(giftTo(INTENDED, { name: 'Alice', hasClaimedName: false }))
        const intended = document.body.textContent
        unmount()

        renderView(giftTo(IMPERSONATOR, { name: 'Alice', hasClaimedName: false }))

        expect(document.body.textContent).not.toEqual(intended)
        expect(screen.getByText('0xbbbb\u20265678')).toBeInTheDocument()
      })
    })

    describe('and the recipient has a claimed name', () => {
      it('should still show the address, since the name alone says nothing about where it goes', () => {
        renderView(giftTo(INTENDED, { name: 'Alice', hasClaimedName: true }))

        expect(screen.getByText('Alice')).toBeInTheDocument()
        expect(screen.getByText('0xaaaa\u20265678')).toBeInTheDocument()
      })
    })

    describe('and the recipient has no profile at all', () => {
      it('should name them by their address', () => {
        renderView(giftTo(INTENDED))

        expect(screen.getByText('0xaaaa\u20265678')).toBeInTheDocument()
      })
    })
  })

  // The place is looked up by the recipient address alone and its name and image are written by whoever
  // deployed it, so its position under the amount must not be allowed to imply that the payment was asked
  // for from there (see fetchPlaceByCreatorAddress).
  describe('and the tip shows a place the recipient deployed', () => {
    // Built explicitly rather than spread: the props are a union on `type`, and spreading loses the
    // discriminant that says which transferData this is.
    const tipAt = (sceneLocation: MANATransferData['sceneLocation']): TransferConfirmViewProps => ({
      type: TransferType.TIP,
      transferData: { ...transferData, sceneLocation },
      isLoading: false,
      onApprove,
      onDeny,
      onCallbackAcknowledgedChange
    })

    it('should name the parcel the place occupies, which is what the user can check', () => {
      renderView(tipAt({ kind: 'genesis', position: '-3,-2' }))

      expect(screen.getByTestId('place-location')).toHaveTextContent('transfer.place_genesis_city {"position":"-3,-2"}')
    })

    it('should name a world by the name that addresses it', () => {
      renderView(tipAt({ kind: 'world', name: 'flagtag.dcl.eth' }))

      expect(screen.getByTestId('place-location')).toHaveTextContent('transfer.place_world {"name":"flagtag.dcl.eth"}')
    })

    it('should show no location when the place could not be located', () => {
      renderView(tipAt(null))

      expect(screen.queryByTestId('place-location')).not.toBeInTheDocument()
      // The caveat stands either way: it is what says the name and the image prove nothing.
      expect(screen.getByTestId('place-not-verified')).toBeInTheDocument()
    })

    it('should say the place is not verified as the one that asked for the payment', () => {
      renderView(props)

      expect(screen.getByTestId('place-not-verified')).toHaveTextContent('transfer.place_not_verified')
    })

    it('should keep the recipient address on screen next to it, which is what was verified', () => {
      renderView(props)

      expect(screen.getByText('transfer.confirm.creator_of')).toBeInTheDocument()
      expect(screen.getByTestId('place-not-verified')).toBeInTheDocument()
    })
  })

  describe('and the transfer is a gift, which shows no place', () => {
    beforeEach(() => {
      props = {
        ...props,
        type: TransferType.GIFT,
        transferData: {
          imageUrl: 'https://example.com/nft.png',
          tokenId: '1',
          toAddress: transferData.toAddress,
          contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          name: 'Hat',
          description: 'A hat',
          rarity: Rarity.COMMON
        }
      }
    })

    it('should show no place note, since there is no place claim to qualify', () => {
      renderView(props)

      expect(screen.queryByTestId('place-not-verified')).not.toBeInTheDocument()
    })
  })
})
