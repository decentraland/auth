import { render } from '@testing-library/react'
import { VerifyingCredentialsView } from './VerifyingCredentialsView'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('../AnimatedBackground', () => ({
  AnimatedBackground: () => null
}))

jest.mock('decentraland-ui2', () => {
  const actual = jest.requireActual('decentraland-ui2')
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    CircularProgress: () => <div data-testid="spinner" />,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Logo: () => <div data-testid="logo" />
  }
})

describe('when rendering the VerifyingCredentialsView', () => {
  describe('and no messageKey is provided', () => {
    it('should render the default validating_sign_in label, logo and spinner', () => {
      const { getByTestId } = render(<VerifyingCredentialsView />)
      expect(getByTestId('verifying-credentials-title')).toHaveTextContent('connection_layout.validating_sign_in')
      expect(getByTestId('logo')).toBeInTheDocument()
      expect(getByTestId('spinner')).toBeInTheDocument()
    })
  })

  describe('and a custom messageKey is provided', () => {
    it('should render the provided translation key as the label', () => {
      const { getByTestId } = render(<VerifyingCredentialsView messageKey="some.custom.key" />)
      expect(getByTestId('verifying-credentials-title')).toHaveTextContent('some.custom.key')
    })
  })
})
