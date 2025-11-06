import { Box, styled } from 'decentraland-ui2'
import magicSvg from '../../assets/images/magic.svg'

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

export {
  PrimaryContainer,
  PrimaryLearnMore,
  PrimaryMagic,
  PrimaryMessage,
  PrimaryOption,
  PrimaryOptionWrapper
}

