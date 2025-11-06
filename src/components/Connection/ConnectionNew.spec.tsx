import { act, fireEvent, render } from '@testing-library/react'
import { darkTheme, DclThemeProvider } from 'decentraland-ui2'
import { ConnectionNew } from './ConnectionNew'
import { EXTRA_TEST_ID, PRIMARY_TEST_ID, SECONDARY_TEST_ID, SHOW_MORE_BUTTON_TEST_ID } from './constants'
import { ConnectionOptionType, ConnectionProps, MetamaskEthereumWindow } from './Connection.types'

function renderConnectionNew(props: Partial<ConnectionProps>) {
  return render(
    <DclThemeProvider theme={darkTheme}>
      <ConnectionNew
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
        isNewUser={false}
        {...props}
      />
    </DclThemeProvider>
  )
}

describe('when rendering ConnectionNew', () => {
  let screen: ReturnType<typeof renderConnectionNew>

  describe('and there are primary, secondary and extra options', () => {
    let connectionOptions: ConnectionProps['connectionOptions']
    let onConnect: jest.Mock
    let onLearnMore: jest.Mock

    beforeEach(() => {
      onConnect = jest.fn()
      onLearnMore = jest.fn()
      connectionOptions = {
        primary: ConnectionOptionType.GOOGLE,
        secondary: ConnectionOptionType.APPLE,
        extraOptions: [ConnectionOptionType.X, ConnectionOptionType.DISCORD]
      }
      screen = renderConnectionNew({ connectionOptions, onConnect, onLearnMore })
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should render the primary and secondary option', () => {
      const { getByTestId } = screen
      expect(getByTestId(PRIMARY_TEST_ID)).toBeInTheDocument()
      expect(getByTestId(SECONDARY_TEST_ID)).toBeInTheDocument()
    })

    it('should call onConnect with the primary option when clicking the primary button', () => {
      const { getByTestId } = screen
      fireEvent.click(getByTestId(`${PRIMARY_TEST_ID}-${ConnectionOptionType.GOOGLE}-button`))
      expect(onConnect).toHaveBeenCalledWith(ConnectionOptionType.GOOGLE)
    })

    it('should call onConnect with the secondary option when clicking the secondary button', () => {
      const { getByTestId } = screen
      fireEvent.click(getByTestId(`${SECONDARY_TEST_ID}-${ConnectionOptionType.APPLE}-button`))
      expect(onConnect).toHaveBeenCalledWith(ConnectionOptionType.APPLE)
    })

    it('should render all the extra options by default when isNewUser is false', () => {
      const { getByTestId } = screen

      connectionOptions?.extraOptions?.forEach(option => {
        expect(getByTestId(`${EXTRA_TEST_ID}-${option}-button`)).toBeInTheDocument()
      })
    })

    it('should hide the extra options when clicking the show more button', () => {
      const { getByTestId, queryByTestId } = screen

      connectionOptions?.extraOptions?.forEach(option => {
        expect(getByTestId(`${EXTRA_TEST_ID}-${option}-button`)).toBeInTheDocument()
      })

      act(() => {
        fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
      })

      connectionOptions?.extraOptions?.forEach(option => {
        expect(queryByTestId(`${EXTRA_TEST_ID}-${option}-button`)).not.toBeInTheDocument()
      })
    })

    it('should show the extra options again when clicking the show more button twice', () => {
      const { getByTestId } = screen

      act(() => {
        fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
      })

      act(() => {
        fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
      })

      connectionOptions?.extraOptions?.forEach(option => {
        expect(getByTestId(`${EXTRA_TEST_ID}-${option}-button`)).toBeInTheDocument()
      })
    })

    it('should call onConnect with the correct option when clicking one of the extra options buttons', () => {
      const { getByTestId } = screen
      connectionOptions?.extraOptions?.forEach(option => {
        fireEvent.click(getByTestId(`${EXTRA_TEST_ID}-${option}-button`))
        expect(onConnect).toHaveBeenCalledWith(option)
      })
    })

    it('should call onLearnMore when clicking the learn more link in primary option', () => {
      const { getAllByText } = screen
      const learnMoreLinks = getAllByText('Learn More')
      fireEvent.click(learnMoreLinks[0])
      expect(onLearnMore).toHaveBeenCalledWith(ConnectionOptionType.GOOGLE)
    })
  })

  describe('and the user has metamask installed', () => {
    let connectionOptions: ConnectionProps['connectionOptions']
    let onConnect: jest.Mock
    let oldEthereum: typeof window.ethereum

    beforeEach(() => {
      oldEthereum = window.ethereum
      ;(window.ethereum as MetamaskEthereumWindow) = {
        ...window.ethereum,
        isMetaMask: true
      } as MetamaskEthereumWindow
      connectionOptions = {
        primary: ConnectionOptionType.METAMASK,
        extraOptions: [ConnectionOptionType.FORTMATIC, ConnectionOptionType.WALLET_CONNECT, ConnectionOptionType.COINBASE]
      }
      onConnect = jest.fn()
      screen = renderConnectionNew({ connectionOptions, onConnect })
    })

    afterEach(() => {
      window.ethereum = oldEthereum
      jest.resetAllMocks()
    })

    it('should call onConnect with METAMASK when clicking the metamask button', () => {
      const { getByTestId } = screen
      fireEvent.click(getByTestId(`${PRIMARY_TEST_ID}-${ConnectionOptionType.METAMASK}-button`))
      expect(onConnect).toHaveBeenCalledWith(ConnectionOptionType.METAMASK)
    })

    it('should not show error message for metamask option', () => {
      const { queryByText } = screen
      expect(queryByText('You need to install the MetaMask Browser Extension')).not.toBeInTheDocument()
    })
  })

  describe('and the user does not have metamask installed', () => {
    let connectionOptions: ConnectionProps['connectionOptions']
    let onConnect: jest.Mock
    let oldEthereum: typeof window.ethereum

    beforeEach(() => {
      oldEthereum = window.ethereum
      window.ethereum = undefined
      connectionOptions = {
        primary: ConnectionOptionType.METAMASK,
        extraOptions: [ConnectionOptionType.FORTMATIC, ConnectionOptionType.WALLET_CONNECT, ConnectionOptionType.COINBASE]
      }
      onConnect = jest.fn()
      screen = renderConnectionNew({ connectionOptions, onConnect })
    })

    afterEach(() => {
      window.ethereum = oldEthereum
      jest.resetAllMocks()
    })

    it('should not call onConnect when clicking the metamask button', () => {
      const { getByTestId } = screen
      fireEvent.click(getByTestId(`${PRIMARY_TEST_ID}-${ConnectionOptionType.METAMASK}-button`))
      expect(onConnect).not.toHaveBeenCalled()
    })

    it('should disable the metamask button when metamask is not installed', () => {
      const { getByTestId } = screen
      const button = getByTestId(`${PRIMARY_TEST_ID}-${ConnectionOptionType.METAMASK}-button`)
      expect(button).toBeDisabled()
    })
  })

  describe('and there is no secondary option', () => {
    let connectionOptions: ConnectionProps['connectionOptions']
    let onConnect: jest.Mock

    beforeEach(() => {
      onConnect = jest.fn()
      connectionOptions = {
        primary: ConnectionOptionType.METAMASK,
        extraOptions: [ConnectionOptionType.FORTMATIC, ConnectionOptionType.WALLET_CONNECT, ConnectionOptionType.COINBASE]
      }
      screen = renderConnectionNew({ connectionOptions, onConnect })
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should render the primary option', () => {
      const { getByTestId } = screen
      expect(getByTestId(PRIMARY_TEST_ID)).toBeInTheDocument()
    })

    it('should not render the secondary option', () => {
      const { queryByTestId } = screen
      expect(queryByTestId(SECONDARY_TEST_ID)).not.toBeInTheDocument()
    })

    it('should render all the extra options by default', () => {
      const { getByTestId } = screen
      connectionOptions?.extraOptions?.forEach(option => {
        expect(getByTestId(`${EXTRA_TEST_ID}-${option}-button`)).toBeInTheDocument()
      })
    })

    it('should call onConnect with the correct option when clicking one of the extra options buttons', () => {
      const { getByTestId } = screen
      connectionOptions?.extraOptions?.forEach(option => {
        fireEvent.click(getByTestId(`${EXTRA_TEST_ID}-${option}-button`))
        expect(onConnect).toHaveBeenCalledWith(option)
      })
    })
  })

  describe('and there are primary, but not secondary nor extra options', () => {
    let connectionOptions: ConnectionProps['connectionOptions']

    beforeEach(() => {
      connectionOptions = {
        primary: ConnectionOptionType.METAMASK
      }
      screen = renderConnectionNew({ connectionOptions })
    })

    it('should render the primary option', () => {
      const { queryByTestId } = screen
      expect(queryByTestId(PRIMARY_TEST_ID)).toBeInTheDocument()
    })

    it('should not render the secondary option', () => {
      const { queryByTestId } = screen
      expect(queryByTestId(SECONDARY_TEST_ID)).not.toBeInTheDocument()
    })

    it('should not render the more options button', () => {
      const { queryByTestId } = screen
      expect(queryByTestId(SHOW_MORE_BUTTON_TEST_ID)).not.toBeInTheDocument()
    })
  })

  describe('and there are no primary nor secondary nor extra options', () => {
    let connectionOptions: ConnectionProps['connectionOptions']

    beforeEach(() => {
      connectionOptions = undefined
      screen = renderConnectionNew({ connectionOptions })
    })

    it('should not render the more options button', () => {
      const { queryByTestId } = screen
      expect(queryByTestId(SHOW_MORE_BUTTON_TEST_ID)).not.toBeInTheDocument()
    })

    it('should not render the primary option', () => {
      const { queryByTestId } = screen
      expect(queryByTestId(PRIMARY_TEST_ID)).not.toBeInTheDocument()
    })

    it('should not render the secondary option', () => {
      const { queryByTestId } = screen
      expect(queryByTestId(SECONDARY_TEST_ID)).not.toBeInTheDocument()
    })
  })

  describe('and the user is a new user', () => {
    let connectionOptions: ConnectionProps['connectionOptions']
    let onConnect: jest.Mock

    beforeEach(() => {
      onConnect = jest.fn()
      connectionOptions = {
        primary: ConnectionOptionType.GOOGLE,
        extraOptions: [ConnectionOptionType.X, ConnectionOptionType.DISCORD]
      }
      screen = renderConnectionNew({ connectionOptions, onConnect, isNewUser: true })
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should not render the extra options by default', () => {
      const { queryByTestId } = screen
      connectionOptions?.extraOptions?.forEach(option => {
        expect(queryByTestId(`${EXTRA_TEST_ID}-${option}-button`)).not.toBeInTheDocument()
      })
    })

    it('should render the show more button', () => {
      const { getByTestId } = screen
      expect(getByTestId(SHOW_MORE_BUTTON_TEST_ID)).toBeInTheDocument()
    })

    it('should show the extra options when clicking the show more button', () => {
      const { getByTestId } = screen

      act(() => {
        fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
      })

      connectionOptions?.extraOptions?.forEach(option => {
        expect(getByTestId(`${EXTRA_TEST_ID}-${option}-button`)).toBeInTheDocument()
      })
    })
  })

  describe('and a loading option is provided', () => {
    let connectionOptions: ConnectionProps['connectionOptions']
    let onConnect: jest.Mock
    let loadingOption: ConnectionOptionType

    beforeEach(() => {
      onConnect = jest.fn()
      loadingOption = ConnectionOptionType.GOOGLE
      connectionOptions = {
        primary: ConnectionOptionType.GOOGLE,
        secondary: ConnectionOptionType.APPLE,
        extraOptions: [ConnectionOptionType.X, ConnectionOptionType.DISCORD]
      }
      screen = renderConnectionNew({ connectionOptions, onConnect, loadingOption })
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should disable all connection buttons when loading', () => {
      const { getByTestId } = screen
      const primaryButton = getByTestId(`${PRIMARY_TEST_ID}-${ConnectionOptionType.GOOGLE}-button`)
      const secondaryButton = getByTestId(`${SECONDARY_TEST_ID}-${ConnectionOptionType.APPLE}-button`)
      const extraButton = getByTestId(`${EXTRA_TEST_ID}-${ConnectionOptionType.X}-button`)

      expect(primaryButton).toBeDisabled()
      expect(secondaryButton).toBeDisabled()
      expect(extraButton).toBeDisabled()
    })

    it('should not call onConnect when clicking a disabled button', () => {
      const { getByTestId } = screen
      fireEvent.click(getByTestId(`${PRIMARY_TEST_ID}-${ConnectionOptionType.GOOGLE}-button`))
      expect(onConnect).not.toHaveBeenCalled()
    })
  })

  describe('and a custom className is provided', () => {
    let connectionOptions: ConnectionProps['connectionOptions']
    let className: string

    beforeEach(() => {
      className = 'custom-class-name'
      connectionOptions = {
        primary: ConnectionOptionType.GOOGLE
      }
      screen = renderConnectionNew({ connectionOptions, className })
    })

    it('should apply the custom className to the container', () => {
      const { container } = screen
      const connectionContainer = container.firstChild
      expect(connectionContainer).toHaveClass(className)
    })
  })

  describe('and a social login option is used', () => {
    let connectionOptions: ConnectionProps['connectionOptions']
    let onLearnMore: jest.Mock

    beforeEach(() => {
      onLearnMore = jest.fn()
      connectionOptions = {
        primary: ConnectionOptionType.GOOGLE
      }
      screen = renderConnectionNew({ connectionOptions, onLearnMore })
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should render the social message with Magic logo', () => {
      const { getByText, getByRole } = screen
      expect(getByText('Access secured by')).toBeInTheDocument()
      expect(getByRole('img', { name: 'Magic' })).toBeInTheDocument()
    })

    it('should call onLearnMore with the option when clicking learn more link', () => {
      const { getByText } = screen
      const learnMoreLink = getByText('Learn More')
      fireEvent.click(learnMoreLink)
      expect(onLearnMore).toHaveBeenCalledWith(ConnectionOptionType.GOOGLE)
    })
  })

  describe('and a web3 login option is used', () => {
    let connectionOptions: ConnectionProps['connectionOptions']
    let onLearnMore: jest.Mock

    beforeEach(() => {
      onLearnMore = jest.fn()
      connectionOptions = {
        primary: ConnectionOptionType.METAMASK
      }
      screen = renderConnectionNew({ connectionOptions, onLearnMore })
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should render the web3 message', () => {
      const { getByText } = screen
      expect(getByText('Curious about wallets?')).toBeInTheDocument()
    })

    it('should call onLearnMore when clicking learn more link in web3 message', () => {
      const { getAllByText } = screen
      const learnMoreLinks = getAllByText('Learn More')
      fireEvent.click(learnMoreLinks[0])
      expect(onLearnMore).toHaveBeenCalledWith(ConnectionOptionType.METAMASK)
    })
  })
})
