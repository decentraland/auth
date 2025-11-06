import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Box, Button, styled, Typography } from 'decentraland-ui2'

const ConnectionContainer = styled(Box)(({ theme }) => ({
  color: theme.palette.common.white,
  display: 'flex',
  flexDirection: 'column'
}))

const DclLogoContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1)
}))

const Title = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(7),
  fontSize: '30px',
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
  color: `${theme.palette.common.white} !important`,
  fontWeight: theme.typography.fontWeightBold,
  display: 'flex',
  gap: theme.spacing(1),
  justifyContent: 'center',
  marginBottom: theme.spacing(2),
  backgroundColor: 'transparent !important',
  ['&:hover']: {
    backgroundColor: 'transparent !important',
    color: `${theme.palette.common.white} !important`,
    opacity: '1 !important'
  },
  ['&:active']: {
    backgroundColor: 'transparent !important',
    color: `${theme.palette.common.white} !important`,
    opacity: '1 !important',
    transform: 'none'
  },
  ['&:focus']: {
    backgroundColor: 'transparent !important',
    color: `${theme.palette.common.white} !important`,
    opacity: '1 !important'
  },
  ['&:focus-visible']: {
    backgroundColor: 'transparent !important',
    color: `${theme.palette.common.white} !important`,
    opacity: '1 !important',
    outline: 'none'
  },
  ['&.MuiButton-text']: {
    color: `${theme.palette.common.white} !important`
  },
  ['&.MuiButton-text:hover']: {
    backgroundColor: 'transparent !important',
    color: `${theme.palette.common.white} !important`
  },
  ['&.MuiButton-text:active']: {
    backgroundColor: 'transparent !important',
    color: `${theme.palette.common.white} !important`
  }
}))

const ChevronIcon = styled(ExpandMoreIcon)({})
const ChevronUpIcon = styled(ExpandLessIcon)({})

export { ChevronIcon, ChevronUpIcon, ConnectionContainer, DclLogoContainer, ShowMoreButton, ShowMoreContainer, Title }
