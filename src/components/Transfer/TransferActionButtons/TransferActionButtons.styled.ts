import { Button } from 'decentraland-ui2/dist/components/Button'
import { Box, styled } from 'decentraland-ui2'

const ButtonsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2.5),
  width: '520px',
  marginTop: theme.spacing(8.75)
}))

const CancelButton = styled(Button)({
  ['&.MuiButtonBase-root.MuiButton-root.MuiButton-contained.MuiButton-containedSecondary.MuiButton-sizeLarge.MuiButton-containedSizeLarge.MuiButton-colorSecondary.MuiButton-fullWidth.MuiButton-root.MuiButton-contained.MuiButton-containedSecondary.MuiButton-sizeLarge.MuiButton-containedSizeLarge.MuiButton-colorSecondary.MuiButton-fullWidth']:
    {
      background: 'rgba(0, 0, 0, 0.40)',
      color: 'white',
      borderRadius: '12px',
      ['&:hover']: {
        background: 'rgba(0, 0, 0, 0.60)'
      }
    }
})

const ConfirmButton = styled(Button)({
  ['&.MuiButtonBase-root.MuiButton-root.MuiButton-contained.MuiButton-containedPrimary.MuiButton-sizeLarge.MuiButton-containedSizeLarge.MuiButton-colorPrimary.MuiButton-fullWidth.MuiButton-root.MuiButton-contained.MuiButton-containedPrimary.MuiButton-sizeLarge.MuiButton-containedSizeLarge.MuiButton-colorPrimary.MuiButton-fullWidth']:
    {
      borderRadius: '12px'
    }
})

export { ButtonsContainer, CancelButton, ConfirmButton }
