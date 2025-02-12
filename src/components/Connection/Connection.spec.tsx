import { act, fireEvent, render } from '@testing-library/react'
import { Connection } from './Connection'
import { EXTRA_TEST_ID, PRIMARY_TEST_ID, SECONDARY_TEST_ID, SHOW_MORE_BUTTON_TEST_ID } from './constants'
import { ConnectionOptionType, ConnectionProps } from './Connection.types'

function renderConnection(props: Partial<ConnectionProps>) {
  return render(
    <Connection
      i18n={{
        title: 'Unlock Your Virtual World.',
        subtitle: 'Access and start exploring.',
        accessWith: option => `Access with ${option}`,
        connectWith: option => `Connect with ${option}`,
        moreOptions: 'More Options',
        socialMessage: element => <>Access secured by {element}</>,
        web3Message: learnMore => <>Curious about wallets? {learnMore('Learn More')}</>
      }}
      onLearnMore={jest.fn()}
      onConnect={jest.fn()}
      {...props}
    />
  )
}

;(window.ethereum as any) = {
  ...window.ethereum,
  isMetaMask: true
}

let screen: ReturnType<typeof renderConnection>

describe('when rendering the component', () => {
  let connectionOptions: ConnectionProps['connectionOptions']
  let onConnect: jest.Mock

  describe('and there are primary, secondary and extra options', () => {
    beforeEach(() => {
      onConnect = jest.fn()
      connectionOptions = {
        primary: ConnectionOptionType.GOOGLE,
        secondary: ConnectionOptionType.APPLE,
        extraOptions: [ConnectionOptionType.X, ConnectionOptionType.DISCORD]
      }
      screen = renderConnection({ connectionOptions, onConnect })
    })

    it('should render the primary and secondary option', () => {
      const { getByTestId } = screen
      expect(getByTestId(PRIMARY_TEST_ID)).toBeInTheDocument()
      expect(getByTestId(SECONDARY_TEST_ID)).toBeInTheDocument()
    })

    it('should call the onConnect method prop when clicking the button', () => {
      const { getByTestId } = screen
      fireEvent.click(getByTestId(`${PRIMARY_TEST_ID}-${ConnectionOptionType.GOOGLE}-button`))
      expect(onConnect).toHaveBeenCalledWith(ConnectionOptionType.GOOGLE)
    })

    it('should render all the extra options by default', () => {
      const { getByTestId } = screen

      connectionOptions?.extraOptions?.forEach(option => {
        expect(getByTestId(`${EXTRA_TEST_ID}-${option}-button`)).toBeInTheDocument()
      })
    })

    it('should hide the extra options when clicking the show more button', () => {
      const { getByTestId, queryByTestId } = screen

      // First verify options are visible initially
      connectionOptions?.extraOptions?.forEach(option => {
        expect(getByTestId(`${EXTRA_TEST_ID}-${option}-button`)).toBeInTheDocument()
      })

      // Click the show more button
      act(() => {
        fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
      })
      connectionOptions?.extraOptions?.forEach(option => {
        expect(queryByTestId(`${EXTRA_TEST_ID}-${option}-button`)).not.toBeInTheDocument()
      })
    })

    it("should call the onConnect method prop when clicking one of the secondary options' button", () => {
      const { getByTestId } = screen
      connectionOptions?.extraOptions?.forEach(option => {
        fireEvent.click(getByTestId(`${EXTRA_TEST_ID}-${option}-button`))
        expect(onConnect).toHaveBeenCalledWith(option)
      })
    })
  })

  describe('and the user has metamask installed', () => {
    let oldEthereum: typeof window.ethereum

    beforeEach(() => {
      oldEthereum = window.ethereum
      ;(window.ethereum as any) = {
        ...window.ethereum,
        isMetaMask: true
      }
      connectionOptions = {
        primary: ConnectionOptionType.METAMASK,
        extraOptions: [ConnectionOptionType.FORTMATIC, ConnectionOptionType.WALLET_CONNECT, ConnectionOptionType.COINBASE]
      }
      onConnect = jest.fn()
      screen = renderConnection({ connectionOptions, onConnect })
    })

    afterEach(() => {
      window.ethereum = oldEthereum
    })

    it('should call the onConnect method prop when clicking the button', () => {
      const { getByTestId } = screen
      fireEvent.click(getByTestId(`${PRIMARY_TEST_ID}-${ConnectionOptionType.METAMASK}-button`))
      expect(onConnect).toHaveBeenCalledWith(ConnectionOptionType.METAMASK)
    })
  })

  describe('and the user does not have metamask installed', () => {
    let oldEthereum: typeof window.ethereum

    beforeEach(() => {
      oldEthereum = window.ethereum
      window.ethereum = undefined
      connectionOptions = {
        primary: ConnectionOptionType.METAMASK,
        extraOptions: [ConnectionOptionType.FORTMATIC, ConnectionOptionType.WALLET_CONNECT, ConnectionOptionType.COINBASE]
      }
      onConnect = jest.fn()
      screen = renderConnection({ connectionOptions, onConnect })
    })

    afterEach(() => {
      window.ethereum = oldEthereum
    })

    it('should not call the onConnect method prop when clicking the button', () => {
      const { getByTestId } = screen
      fireEvent.click(getByTestId(`${PRIMARY_TEST_ID}-${ConnectionOptionType.METAMASK}-button`))
      expect(onConnect).not.toHaveBeenCalled()
    })
  })

  describe('and there are is not secondary options', () => {
    beforeEach(() => {
      onConnect = jest.fn()
      connectionOptions = {
        primary: ConnectionOptionType.METAMASK,
        extraOptions: [ConnectionOptionType.FORTMATIC, ConnectionOptionType.WALLET_CONNECT, ConnectionOptionType.COINBASE]
      }
      screen = renderConnection({ connectionOptions, onConnect })
    })

    it('should render the primary option', () => {
      const { getByTestId } = screen
      expect(getByTestId(PRIMARY_TEST_ID)).toBeInTheDocument()
    })

    it('should not render the secondary', () => {
      const { queryByTestId } = screen
      expect(queryByTestId(SECONDARY_TEST_ID)).not.toBeInTheDocument()
    })

    it('should render all the extra options by default', () => {
      const { getByTestId } = screen
      connectionOptions?.extraOptions?.forEach(option => {
        expect(getByTestId(`${EXTRA_TEST_ID}-${option}-button`)).toBeInTheDocument()
      })
    })

    it("should call the onConnect method prop when clicking one of the secondary options' button", () => {
      const { getByTestId } = screen
      connectionOptions?.extraOptions?.forEach(option => {
        fireEvent.click(getByTestId(`${EXTRA_TEST_ID}-${option}-button`))
        expect(onConnect).toHaveBeenCalledWith(option)
      })
    })
  })

  describe('and there are primary, but not secondary nor extra options', () => {
    beforeEach(() => {
      connectionOptions = {
        primary: ConnectionOptionType.METAMASK
      }
      screen = renderConnection({ connectionOptions })
    })

    it('should render the primary', () => {
      const { queryByTestId } = screen
      expect(queryByTestId(PRIMARY_TEST_ID)).toBeInTheDocument()
    })

    it('should not render the secondary', () => {
      const { queryByTestId } = screen
      expect(queryByTestId(SECONDARY_TEST_ID)).not.toBeInTheDocument()
    })

    it('should not render the more options button', () => {
      const { queryByTestId } = screen
      expect(queryByTestId(SHOW_MORE_BUTTON_TEST_ID)).not.toBeInTheDocument()
    })
  })

  describe('and there are no primary nor secondary nor extra options', () => {
    beforeEach(() => {
      connectionOptions = undefined
      screen = renderConnection({ connectionOptions })
    })

    it('should not render the more options button', () => {
      const { queryByTestId } = screen
      expect(queryByTestId(SHOW_MORE_BUTTON_TEST_ID)).not.toBeInTheDocument()
    })
  })
})
