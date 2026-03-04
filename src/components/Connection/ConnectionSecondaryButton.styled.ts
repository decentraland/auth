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

// decentraland-ui2 theme applies hover styles with very high specificity (0,6,0):
//   .css-xxx.MuiButton-sizeSmall.MuiButton-containedSecondary:not(.Mui-disabled):not(.Mui-focusVisible):hover
// To beat it from a parent without !important we need specificity > 0,6,0.
// Doubling .MuiButton-root (.MuiButton-root.MuiButton-root) is a standard CSS
// specificity bump that gives us 0,7,0 (parent + root×2 + contained + 2×:not + :hover).
const hoverSelector = [
  '& .MuiButton-root.MuiButton-root.MuiButton-contained:not(.Mui-disabled):not(.Mui-focusVisible):hover',
  '& .MuiButton-root.MuiButton-root.MuiButton-containedPrimary:not(.Mui-disabled):not(.Mui-focusVisible):hover',
  '& .MuiButton-root.MuiButton-root.MuiButton-containedSecondary:not(.Mui-disabled):not(.Mui-focusVisible):hover'
].join(', ')

const activeSelector = [
  '& .MuiButton-root.MuiButton-root.MuiButton-contained:not(.Mui-disabled):not(.Mui-focusVisible):active',
  '& .MuiButton-root.MuiButton-root.MuiButton-containedPrimary:not(.Mui-disabled):not(.Mui-focusVisible):active',
  '& .MuiButton-root.MuiButton-root.MuiButton-containedSecondary:not(.Mui-disabled):not(.Mui-focusVisible):active'
].join(', ')

const SecondaryOptionButton = styled(Box)(({ theme }) => ({
  width: '100%',
  minWidth: '46px',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- CSS selectors
  '& .MuiButton-contained, & .MuiButton-containedPrimary, & .MuiButton-containedSecondary': {
    width: '100%',
    minWidth: '46px',
    backgroundColor: theme.palette.common.white,
    color: theme.palette.common.black,
    transition: 'transform 0.2s ease-in-out',
    [theme.breakpoints.down('xs')]: {
      margin: 'auto'
    }
  },
  [hoverSelector]: {
    backgroundColor: theme.palette.common.white,
    color: theme.palette.common.black,
    boxShadow: 'none',
    transform: 'translateY(-2px)'
  },
  [activeSelector]: {
    backgroundColor: theme.palette.common.white,
    color: theme.palette.common.black,
    boxShadow: 'none',
    transform: 'translateY(0)'
  }
}))

export { SecondaryOptionButton, ShowMoreSecondaryOptions }
