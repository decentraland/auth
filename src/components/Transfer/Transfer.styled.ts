import { Alert, Box, Typography, styled } from 'decentraland-ui2'

const CenteredContent = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  maxWidth: theme.spacing(75),
  textAlign: 'center',
  width: 'fit-content'
}))

const ItemName = styled(Box)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(22),
  fontWeight: 600,
  marginTop: theme.spacing(2.5)
}))

const Label = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(18),
  fontWeight: 400,
  marginTop: theme.spacing(6.25),
  opacity: 0.8
}))

const Title = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(36),
  fontStyle: 'normal',
  fontWeight: 600,
  letterSpacing: '0px',
  lineHeight: '100%',
  marginBottom: theme.spacing(2.5),
  textAlign: 'center'
}))

const WarningAlert = styled(Alert)(({ theme }) => ({
  alignItems: 'center',
  alignSelf: 'center',
  backgroundColor: 'transparent',
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(18),
  justifyContent: 'center',
  maxWidth: theme.spacing(100),
  width: '100%',
  marginTop: theme.spacing(5),
  marginBottom: theme.spacing(-8),
  ['& .MuiAlert-icon']: {
    alignItems: 'center',
    color: theme.palette.text.primary,
    marginRight: theme.spacing(1.5)
  }
}))

export { CenteredContent, ItemName, Label, Title, WarningAlert }
