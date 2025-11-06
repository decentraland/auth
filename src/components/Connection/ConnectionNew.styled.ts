import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Box, Button, styled, Typography } from 'decentraland-ui2'
import magicSvg from '../../assets/images/magic.svg'

const ConnectionContainer = styled(Box)(({ theme }) => ({
  color: theme.palette.common.white,
  display: 'flex',
  flexDirection: 'column'
}))

const DclLogoContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3)
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

const PrimaryMagic = styled('div')({
  backgroundImage: `url(${magicSvg})`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  backgroundSize: 'contain',
  width: '66px',
  height: '24px'
})

const PrimaryLearnMore = styled('span')({
  textDecoration: 'underline',
  cursor: 'pointer'
})

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

const ShowMoreSecondaryOptions = styled(Box)(({ theme }) => ({
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: theme.spacing(3),
  ['& + &']: {
    marginTop: theme.spacing(2)
  },
  [theme.breakpoints.down('xs')]: {
    gridTemplateColumns: 'repeat(1, 1fr)'
  }
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

const SecondaryOptionButton = styled(Box)(({ theme }) => ({
  width: '100%',
  minWidth: '46px',
  ['& .ui.button.primary']: {
    width: '100%',
    minWidth: '46px',
    backgroundColor: theme.palette.common.white,
    color: theme.palette.common.black,
    [theme.breakpoints.down('xs')]: {
      margin: 'auto'
    }
  }
}))

const ChevronIcon = styled(ExpandMoreIcon)({})
const ChevronUpIcon = styled(ExpandLessIcon)({})

export {
  ChevronIcon,
  ChevronUpIcon,
  ConnectionContainer,
  DclLogoContainer,
  PrimaryContainer,
  PrimaryLearnMore,
  PrimaryMagic,
  PrimaryMessage,
  PrimaryOption,
  PrimaryOptionWrapper,
  SecondaryOptionButton,
  ShowMoreButton,
  ShowMoreContainer,
  ShowMoreSecondaryOptions,
  Title
}
