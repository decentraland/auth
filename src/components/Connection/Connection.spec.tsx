import { act, fireEvent, render } from '@testing-library/react'
import { Connection } from './Connection'
import {
  SHOW_MORE_BUTTON_TEST_ID,
  SOCIAL_PRIMARY_TEST_ID,
  SOCIAL_SECONDARY_TEST_ID,
  WEB3_PRIMARY_TEST_ID,
  WEB3_SECONDARY_TEST_ID
} from './constants'
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
  let socialOptions: ConnectionProps['socialOptions'] | undefined
  let web3Options: ConnectionProps['web3Options'] | undefined
  let onConnect: jest.Mock

  describe('and there are no social options', () => {
    beforeEach(() => {
      socialOptions = undefined
      screen = renderConnection({ socialOptions })
    })

    it('should not render the primary social option', () => {
      const { queryByTestId } = screen
      expect(queryByTestId(SOCIAL_PRIMARY_TEST_ID)).not.toBeInTheDocument()
    })
  })

  describe('and there are social options', () => {
    beforeEach(() => {
      onConnect = jest.fn()
      socialOptions = {
        primary: ConnectionOptionType.GOOGLE,
        secondary: [ConnectionOptionType.APPLE, ConnectionOptionType.X, ConnectionOptionType.DISCORD]
      }
      screen = renderConnection({ socialOptions, onConnect })
    })

    it('should render the primary social option', () => {
      const { getByTestId } = screen
      expect(getByTestId(SOCIAL_PRIMARY_TEST_ID)).toBeInTheDocument()
    })

    it('should call the onConnect method prop when clicking the button', () => {
      const { getByTestId } = screen
      fireEvent.click(getByTestId(`${SOCIAL_PRIMARY_TEST_ID}-${ConnectionOptionType.GOOGLE}-button`))
      expect(onConnect).toHaveBeenCalledWith(ConnectionOptionType.GOOGLE)
    })

    it('should render all the secondary options', () => {
      const { getByTestId } = screen
      act(() => {
        fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
      })
      socialOptions?.secondary.forEach(option => {
        expect(getByTestId(`${SOCIAL_SECONDARY_TEST_ID}-${option}-button`)).toBeInTheDocument()
      })
    })

    it("should call the onConnect method prop when clicking one of the secondary options' button", () => {
      const { getByTestId } = screen
      act(() => {
        fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
      })
      socialOptions?.secondary.forEach(option => {
        fireEvent.click(getByTestId(`${SOCIAL_SECONDARY_TEST_ID}-${option}-button`))
        expect(onConnect).toHaveBeenCalledWith(option)
      })
    })
  })

  describe('and there are no primary web3 options', () => {
    beforeEach(() => {
      socialOptions = undefined
      screen = renderConnection({ socialOptions })
    })

    it('should not render the primary web3 option', () => {
      const { queryByTestId } = screen
      expect(queryByTestId(WEB3_PRIMARY_TEST_ID)).not.toBeInTheDocument()
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
      web3Options = {
        primary: ConnectionOptionType.METAMASK,
        secondary: [ConnectionOptionType.FORTMATIC, ConnectionOptionType.WALLET_CONNECT, ConnectionOptionType.COINBASE]
      }
      onConnect = jest.fn()
      screen = renderConnection({ web3Options, onConnect })
    })

    afterEach(() => {
      window.ethereum = oldEthereum
    })

    it('should call the onConnect method prop when clicking the button', () => {
      const { getByTestId } = screen
      fireEvent.click(getByTestId(`${WEB3_PRIMARY_TEST_ID}-${ConnectionOptionType.METAMASK}-button`))
      expect(onConnect).toHaveBeenCalledWith(ConnectionOptionType.METAMASK)
    })
  })

  describe('and the user does not have metamask installed', () => {
    let oldEthereum: typeof window.ethereum

    beforeEach(() => {
      oldEthereum = window.ethereum
      window.ethereum = undefined
      web3Options = {
        primary: ConnectionOptionType.METAMASK,
        secondary: [ConnectionOptionType.FORTMATIC, ConnectionOptionType.WALLET_CONNECT, ConnectionOptionType.COINBASE]
      }
      onConnect = jest.fn()
      screen = renderConnection({ web3Options, onConnect })
    })

    afterEach(() => {
      window.ethereum = oldEthereum
    })

    it('should not call the onConnect method prop when clicking the button', () => {
      const { getByTestId } = screen
      fireEvent.click(getByTestId(`${WEB3_PRIMARY_TEST_ID}-${ConnectionOptionType.METAMASK}-button`))
      expect(onConnect).not.toHaveBeenCalled()
    })
  })

  describe('and there are web3 options', () => {
    beforeEach(() => {
      onConnect = jest.fn()
      web3Options = {
        primary: ConnectionOptionType.METAMASK,
        secondary: [ConnectionOptionType.FORTMATIC, ConnectionOptionType.WALLET_CONNECT, ConnectionOptionType.COINBASE]
      }
      screen = renderConnection({ web3Options, onConnect })
    })

    it('should render the primary social option', () => {
      const { getByTestId } = screen
      expect(getByTestId(WEB3_PRIMARY_TEST_ID)).toBeInTheDocument()
    })

    it('should render all the secondary options', () => {
      const { getByTestId } = screen
      act(() => {
        fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
      })
      web3Options?.secondary.forEach(option => {
        expect(getByTestId(`${WEB3_SECONDARY_TEST_ID}-${option}-button`)).toBeInTheDocument()
      })
    })

    it("should call the onConnect method prop when clicking one of the secondary options' button", () => {
      const { getByTestId } = screen
      act(() => {
        fireEvent.click(getByTestId(SHOW_MORE_BUTTON_TEST_ID))
      })
      web3Options?.secondary.forEach(option => {
        fireEvent.click(getByTestId(`${WEB3_SECONDARY_TEST_ID}-${option}-button`))
        expect(onConnect).toHaveBeenCalledWith(option)
      })
    })
  })

  describe('and there are no web3 nor social secondary options', () => {
    beforeEach(() => {
      socialOptions = undefined
      web3Options = undefined
      screen = renderConnection({ socialOptions, web3Options })
    })

    it('should not render the more options button', () => {
      const { queryByTestId } = screen
      expect(queryByTestId(SHOW_MORE_BUTTON_TEST_ID)).not.toBeInTheDocument()
    })
  })
})
