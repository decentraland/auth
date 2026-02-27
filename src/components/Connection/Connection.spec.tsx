import { act, fireEvent, render } from '@testing-library/react'
import { TranslationProvider } from '@dcl/hooks'
import { DclThemeProvider, darkTheme } from 'decentraland-ui2'
import { translations } from '../../modules/translations'
import { Connection as ConnectionNew } from './Connection'
import { EXTRA_TEST_ID, PRIMARY_TEST_ID, SECONDARY_TEST_ID, SHOW_MORE_BUTTON_TEST_ID } from './constants'
import { ConnectionOptionType, ConnectionProps, MetamaskEthereumWindow } from './Connection.types'

declare global {
  interface Window {
    ethereum?: { isMetaMask?: boolean }
  }
}

function renderConnectionNew(props: Partial<ConnectionProps>) {
  return render(
    <TranslationProvider locale="en" translations={translations} fallbackLocale="en">
      <DclThemeProvider theme={darkTheme}>
        <ConnectionNew onConnect={jest.fn()} isNewUser={false} {...props} />
      </DclThemeProvider>
    </TranslationProvider>
  )
}

describe('when rendering ConnectionNew', () => {
  let screen: ReturnType<typeof renderConnectionNew>

  describe('and there are primary, secondary and extra options', () => {
    let connectionOptions: ConnectionProps['connectionOptions']
    let onConnect: jest.Mock

    beforeEach(() => {
      onConnect = jest.fn()
      connectionOptions = {
        primary: ConnectionOptionType.GOOGLE,
        secondary: ConnectionOptionType.APPLE,
        extraOptions: [ConnectionOptionType.X, ConnectionOptionType.DISCORD]
      }
      screen = renderConnectionNew({ connectionOptions, onConnect })
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should render the regular title', () => {
      const { getByText } = screen
      expect(getByText('Log in or Sign up to Jump In')).toBeInTheDocument()
    })

    it('should not render the new user title', () => {
      const { queryByText } = screen
      expect(queryByText('Create an Account to Jump In')).not.toBeInTheDocument()
    })

    it('should not render the Decentraland title', () => {
      const { queryByText } = screen
      expect(queryByText('Decentraland')).not.toBeInTheDocument()
    })

    it('should render the primary option', () => {
      const { getByTestId } = screen
      expect(getByTestId(PRIMARY_TEST_ID)).toBeInTheDocument()
    })

    it('should render the secondary option', () => {
      const { getByTestId } = screen
      expect(getByTestId(SECONDARY_TEST_ID)).toBeInTheDocument()
    })

    describe('and the user clicks the primary button', () => {
      it('should call onConnect with the primary option', () => {
        const { getByTestId } = screen
        fireEvent.click(getByTestId(`${PRIMARY_TEST_ID}-${ConnectionOptionType.GOOGLE}-button`))
        expect(onConnect).toHaveBeenCalledWith(ConnectionOptionType.GOOGLE)
      })
    })

    describe('and the user clicks the secondary button', () => {
      it('should call onConnect with the secondary option', () => {
        const { getByTestId } = screen
        fireEvent.click(getByTestId(`${SECONDARY_TEST_ID}-${ConnectionOptionType.APPLE}-button`))
        expect(onConnect).toHaveBeenCalledWith(ConnectionOptionType.APPLE)
      })
    })

    it('should not render extra options by default', () => {
      const { queryByTestId } = screen

      connectionOptions?.extraOptions?.forEach(option => {
        expect(queryByTestId(`${EXTRA_TEST_ID}-${option}-button`)).not.toBeInTheDocument()
      })
    })

    describe('and the user clicks the show more button', () => {
      it('should show the extra options', () => {
        const { getByTestId, queryByTestId } = screen

        connectionOptions?.extraOptions?.forEach(option => {
          expect(queryByTestId(`${EXTRA_TEST_ID}-${option}-button`)).not.toBeInTheDocument()
        })

        act(() => {
          fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
        })

        connectionOptions?.extraOptions?.forEach(option => {
          expect(getByTestId(`${EXTRA_TEST_ID}-${option}-button`)).toBeInTheDocument()
        })
      })

      describe('and the user clicks it again', () => {
        it('should hide the extra options again', () => {
          const { getByTestId, queryByTestId } = screen

          act(() => {
            fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
          })

          act(() => {
            fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
          })

          connectionOptions?.extraOptions?.forEach(option => {
            expect(queryByTestId(`${EXTRA_TEST_ID}-${option}-button`)).not.toBeInTheDocument()
          })
        })
      })
    })

    describe('and the user clicks one of the extra options buttons', () => {
      it('should call onConnect with the correct option', () => {
        const { getByTestId } = screen

        act(() => {
          fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
        })

        connectionOptions?.extraOptions?.forEach(option => {
          fireEvent.click(getByTestId(`${EXTRA_TEST_ID}-${option}-button`))
          expect(onConnect).toHaveBeenCalledWith(option)
        })
      })
    })
  })

  describe('and the user has metamask installed', () => {
    let connectionOptions: ConnectionProps['connectionOptions']
    let onConnect: jest.Mock
    let oldEthereum: Window['ethereum']

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

    describe('and the user clicks the metamask button', () => {
      it('should call onConnect with METAMASK', () => {
        const { getByTestId } = screen
        fireEvent.click(getByTestId(`${PRIMARY_TEST_ID}-${ConnectionOptionType.METAMASK}-button`))
        expect(onConnect).toHaveBeenCalledWith(ConnectionOptionType.METAMASK)
      })
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

    describe('and the user clicks the metamask button', () => {
      it('should not call onConnect', () => {
        const { getByTestId } = screen
        fireEvent.click(getByTestId(`${PRIMARY_TEST_ID}-${ConnectionOptionType.METAMASK}-button`))
        expect(onConnect).not.toHaveBeenCalled()
      })
    })

    it('should disable the metamask button', () => {
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

    it('should not render extra options by default', () => {
      const { queryByTestId } = screen
      connectionOptions?.extraOptions?.forEach(option => {
        expect(queryByTestId(`${EXTRA_TEST_ID}-${option}-button`)).not.toBeInTheDocument()
      })
    })

    describe('and the user clicks one of the extra options buttons', () => {
      it('should call onConnect with the correct option', () => {
        const { getByTestId } = screen

        act(() => {
          fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
        })

        connectionOptions?.extraOptions?.forEach(option => {
          fireEvent.click(getByTestId(`${EXTRA_TEST_ID}-${option}-button`))
          expect(onConnect).toHaveBeenCalledWith(option)
        })
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

    it('should render the Decentraland title', () => {
      const { getByText } = screen
      expect(getByText('Decentraland')).toBeInTheDocument()
    })

    it('should render Decentraland title with DecentralandHero font', () => {
      const { getByText } = screen
      const decentralandTitle = getByText('Decentraland')
      expect(decentralandTitle).toHaveStyle({ fontFamily: 'DecentralandHero' })
    })

    it('should render the new user title', () => {
      const { getByText } = screen
      expect(getByText('Create an Account to Jump In')).toBeInTheDocument()
    })

    it('should not render the regular title', () => {
      const { queryByText } = screen
      expect(queryByText('Log in or Sign up to Jump In')).not.toBeInTheDocument()
    })

    it('should not render the social message text', () => {
      const { queryByText } = screen
      expect(queryByText('Access secured by')).not.toBeInTheDocument()
    })

    it('should not render the Magic logo', () => {
      const { queryByRole } = screen
      expect(queryByRole('img', { name: 'Magic' })).not.toBeInTheDocument()
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

    describe('and the user clicks the show more button', () => {
      it('should show the extra options', () => {
        const { getByTestId } = screen

        act(() => {
          fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
        })

        connectionOptions?.extraOptions?.forEach(option => {
          expect(getByTestId(`${EXTRA_TEST_ID}-${option}-button`)).toBeInTheDocument()
        })
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

    it('should disable the primary button', () => {
      const { getByTestId } = screen
      const primaryButton = getByTestId(`${PRIMARY_TEST_ID}-${ConnectionOptionType.GOOGLE}-button`)
      expect(primaryButton).toBeDisabled()
    })

    it('should disable the secondary button', () => {
      const { getByTestId } = screen
      const secondaryButton = getByTestId(`${SECONDARY_TEST_ID}-${ConnectionOptionType.APPLE}-button`)
      expect(secondaryButton).toBeDisabled()
    })

    it('should disable the extra options buttons', () => {
      const { getByTestId } = screen

      act(() => {
        fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
      })

      const extraButton = getByTestId(`${EXTRA_TEST_ID}-${ConnectionOptionType.X}-button`)
      expect(extraButton).toBeDisabled()
    })

    describe('and the user clicks a disabled button', () => {
      it('should not call onConnect', () => {
        const { getByTestId } = screen
        fireEvent.click(getByTestId(`${PRIMARY_TEST_ID}-${ConnectionOptionType.GOOGLE}-button`))
        expect(onConnect).not.toHaveBeenCalled()
      })
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

    beforeEach(() => {
      connectionOptions = {
        primary: ConnectionOptionType.GOOGLE
      }
      screen = renderConnectionNew({ connectionOptions })
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should render the primary option', () => {
      const { getByTestId } = screen
      expect(getByTestId(PRIMARY_TEST_ID)).toBeInTheDocument()
    })
  })

  describe('and a social login option is used with isNewUser true', () => {
    let connectionOptions: ConnectionProps['connectionOptions']

    beforeEach(() => {
      connectionOptions = {
        primary: ConnectionOptionType.GOOGLE
      }
      screen = renderConnectionNew({ connectionOptions, isNewUser: true })
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should not render the social message text', () => {
      const { queryByText } = screen
      expect(queryByText('Access secured by')).not.toBeInTheDocument()
    })

    it('should not render the Magic logo', () => {
      const { queryByRole } = screen
      expect(queryByRole('img', { name: 'Magic' })).not.toBeInTheDocument()
    })
  })

  describe('and a web3 login option is used', () => {
    let connectionOptions: ConnectionProps['connectionOptions']

    beforeEach(() => {
      connectionOptions = {
        primary: ConnectionOptionType.METAMASK
      }
      screen = renderConnectionNew({ connectionOptions })
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should render the primary option', () => {
      const { getByTestId } = screen
      expect(getByTestId(PRIMARY_TEST_ID)).toBeInTheDocument()
    })
  })
})
