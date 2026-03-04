import { Alert, styled, dclColors } from 'decentraland-ui2'

const AlertContainer = styled(Alert)(({ theme }) => ({
  alignItems: 'center',
  alignSelf: 'center',
  backgroundColor: '#00000033',
  borderRadius: '12px',
  color: dclColors.neutral.softWhite,
  fontSize: theme.typography.pxToRem(18),
  justifyContent: 'center',
  marginTop: theme.spacing(4.5),
  width: 'fit-content',
  height: '46px',
  gap: theme.spacing(1.5),
  ['& .MuiAlert-icon']: {
    alignItems: 'center',
    color: dclColors.neutral.softWhite
  }
}))

export { AlertContainer }
