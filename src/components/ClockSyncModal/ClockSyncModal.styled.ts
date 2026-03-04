import { Box, Button, IconButton, styled, Typography } from 'decentraland-ui2'

const Content = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: theme.spacing(5),
  paddingBottom: theme.spacing(5)
}))

const WarningIcon = styled('img')(({ theme }) => ({
  width: 48,
  height: 48,
  marginBottom: theme.spacing(3)
}))

const Title = styled(Typography)(({ theme }) => ({
  fontSize: '20px',
  color: theme.palette.text.primary,
  lineHeight: 1.5,
  fontWeight: theme.typography.fontWeightBold
}))

const Message = styled(Typography)(({ theme }) => ({
  fontSize: '16px',
  color: theme.palette.text.primary,
  textAlign: 'center',
  width: '450px',
  paddingLeft: theme.spacing(6),
  paddingRight: theme.spacing(6),
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(3)
}))

const Actions = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1.5),
  justifyContent: 'center'
}))

const ContinueButton = styled(Button)({
  minWidth: '120px'
})

const CloseIconButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  right: theme.spacing(1),
  top: theme.spacing(1),
  color: 'white'
}))

export { Actions, CloseIconButton, Content, ContinueButton, Message, Title, WarningIcon }
