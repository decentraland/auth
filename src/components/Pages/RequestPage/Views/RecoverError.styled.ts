import { Button, muiIcons, styled } from 'decentraland-ui2'
import { brand } from 'decentraland-ui2/dist/theme/colors'

const ErrorMessageIcon = styled(muiIcons.ErrorOutline)({
  color: '#fb3b3b'
})

/* eslint-disable @typescript-eslint/naming-convention */
const TryAgainButton = styled(Button)({
  '&.MuiButton-sizeMedium.MuiButton-containedPrimary': {
    backgroundColor: brand.ruby,
    borderRadius: 12,
    padding: '10px 48px',
    marginTop: 24,
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: '0.46px',
    textTransform: 'uppercase',
    '&:hover': {
      backgroundColor: '#E6274D'
    }
  }
})
/* eslint-enable @typescript-eslint/naming-convention */

export { ErrorMessageIcon, TryAgainButton }
