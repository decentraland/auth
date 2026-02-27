import { Box, styled } from 'decentraland-ui2'

const ShowMoreSecondaryOptions = styled(Box)(({ theme }) => ({
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: theme.spacing(3),
  ['& + &']: {
    marginTop: theme.spacing(2)
  }
}))

const SecondaryOptionButton = styled(Box)(({ theme }) => ({
  width: '100%',
  minWidth: '46px',
  ['& .MuiButton-contained, & .MuiButton-containedPrimary, & .MuiButton-containedSecondary']: {
    width: '100%',
    minWidth: '46px',
    backgroundColor: theme.palette.common.white,
    color: theme.palette.common.black,
    transition: 'transform 0.2s ease-in-out',
    [theme.breakpoints.down('xs')]: {
      margin: 'auto'
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention -- CSS pseudo-selector
    '&:hover': {
      backgroundColor: theme.palette.common.white,
      color: theme.palette.common.black,
      transform: 'translateY(-2px)'
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention -- CSS pseudo-selector
    '&:active': {
      backgroundColor: theme.palette.common.white,
      color: theme.palette.common.black,
      transform: 'translateY(0)'
    }
  }
}))

export { SecondaryOptionButton, ShowMoreSecondaryOptions }
