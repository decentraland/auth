/* eslint-disable @typescript-eslint/naming-convention */
import { Box, Button, Typography, muiIcons, styled } from 'decentraland-ui2'

const ExpandLessIcon = muiIcons.ExpandLess
const ExpandMoreIcon = muiIcons.ExpandMore

const ConnectionContainer = styled(Box)(({ theme }) => ({
  color: theme.palette.common.white,
  display: 'flex',
  flexDirection: 'column',
  [theme.breakpoints.down('xs')]: {
    marginTop: theme.spacing(4)
  }
}))

const DclLogoContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5)
}))

const DecentralandText = styled(Typography)({
  fontFamily: 'DecentralandHero',
  fontSize: '48px'
})

const MainContentContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(17.5)
}))

const Title = styled(Typography, {
  shouldForwardProp: prop => prop !== 'isNewUser'
})<{ isNewUser?: boolean }>(({ theme, isNewUser }) => ({
  marginBottom: isNewUser ? theme.spacing(4) : theme.spacing(7),
  fontSize: '24px',
  color: theme.palette.common.white,
  boxSizing: 'border-box',
  display: 'block',
  fontWeight: '600',
  letterSpacing: '0.13132px'
}))

const ShowMoreContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(4.375)
}))

const ShowMoreButton = styled(Button)(({ theme }) => ({
  '&.MuiButton-root': {
    color: theme.palette.common.white,
    fontWeight: theme.typography.fontWeightBold,
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'center',
    marginBottom: theme.spacing(2),
    backgroundColor: 'transparent'
  },
  '&.MuiButton-root:hover': {
    backgroundColor: 'transparent',
    color: theme.palette.common.white,
    opacity: 1
  },
  '&.MuiButton-root:active': {
    backgroundColor: 'transparent',
    color: theme.palette.common.white,
    opacity: 1,
    transform: 'none'
  },
  '&.MuiButton-root:focus': {
    backgroundColor: 'transparent',
    color: theme.palette.common.white,
    opacity: 1
  },
  '&.MuiButton-root:focus-visible': {
    backgroundColor: 'transparent',
    color: theme.palette.common.white,
    opacity: 1,
    outline: 'none'
  }
}))

const ChevronIcon = styled(ExpandMoreIcon)({})
const ChevronUpIcon = styled(ExpandLessIcon)({})

const dividerLineStyle = {
  content: '""',
  flex: 1,
  height: '1px',
  background: 'rgba(255, 255, 255, 0.2)'
}

const Divider = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  margin: `${theme.spacing(3)} 0`,
  color: 'rgba(255, 255, 255, 0.5)',
  fontSize: '13px',

  '&::before': dividerLineStyle,

  '&::after': dividerLineStyle
}))

export {
  ChevronIcon,
  ChevronUpIcon,
  ConnectionContainer,
  DclLogoContainer,
  DecentralandText,
  Divider,
  MainContentContainer,
  ShowMoreButton,
  ShowMoreContainer,
  Title
}
