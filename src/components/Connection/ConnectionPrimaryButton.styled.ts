import { Box, Button, styled } from 'decentraland-ui2'

const PrimaryContainer = styled(Box)(({ theme }) => ({
  ['& + &']: {
    marginTop: theme.spacing(2.5)
  }
}))

const PrimaryMessage = styled(Box)(({ theme }) => ({
  fontSize: '16px',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: theme.spacing(2.375),
  gap: theme.spacing(1.5)
}))

const PrimaryOptionWrapper = styled(Box)(({ theme }) => ({
  width: '100%',
  ['& .ui.button.primary']: {
    backgroundColor: theme.palette.common.white,
    color: theme.palette.common.black,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%'
  }
}))

const PrimaryOption = styled(Box)({
  width: '100%'
})

const PrimaryButton = styled(Button, {
  shouldForwardProp: prop => prop !== 'isNewUser'
})<{ isNewUser?: boolean }>(({ theme, isNewUser }) => ({
  width: '100%',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: theme.palette.common.white,
  fontWeight: 600,
  height: theme.spacing(5.75),
  justifyContent: isNewUser ? 'flex-start' : 'center',
  gap: 0,
  transition: 'transform 0.2s ease-in-out',
  [theme.breakpoints.down('sm')]: {
    height: theme.spacing(7.25)
  },
  ['&.MuiButton-root']: {
    backgroundColor: theme.palette.common.white,
    color: theme.palette.common.black
  },
  ['& .MuiButton-startIcon']: {
    margin: 0,
    marginRight: theme.spacing(1)
  },
  ['&:hover']: {
    backgroundColor: theme.palette.common.white,
    transform: 'translateY(-2px)'
  },
  ['&:active']: {
    backgroundColor: theme.palette.common.white,
    transform: 'translateY(0)'
  },
  ['&:focus']: {
    backgroundColor: theme.palette.common.white,
    color: theme.palette.common.black
  },
  ['&:focus-visible']: {
    backgroundColor: theme.palette.common.white,
    color: theme.palette.common.black
  },
  ['&.MuiButton-text']: {
    backgroundColor: theme.palette.common.white,
    color: theme.palette.common.black
  },
  ['&.MuiButton-text:hover']: {
    backgroundColor: theme.palette.common.white,
    transform: 'translateY(-2px)'
  },
  ['&.MuiButton-text:active']: {
    backgroundColor: theme.palette.common.white,
    transform: 'translateY(0)'
  }
}))

const PrimaryButtonWrapper = styled(Box, {
  shouldForwardProp: prop => prop !== 'isNewUser'
})<{ isNewUser?: boolean }>(({ isNewUser, theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: isNewUser ? '100%' : 'auto',
  color: theme.palette.common.black,
  fontSize: '14px'
}))

export { PrimaryButton, PrimaryButtonWrapper, PrimaryContainer, PrimaryMessage, PrimaryOption, PrimaryOptionWrapper }
