import { Box, styled } from 'decentraland-ui2'

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

export {
  SecondaryOptionButton,
  ShowMoreSecondaryOptions
}

