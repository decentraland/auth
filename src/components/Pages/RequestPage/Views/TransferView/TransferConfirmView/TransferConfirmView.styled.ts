import { styled } from 'decentraland-ui2'

// Next to the recipient it belongs to, and quiet: the address itself is what the screen states, and this is
// only the way to go and look it up.
const RecipientExplorerLink = styled('a')(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(13),
  marginTop: theme.spacing(1),
  opacity: 0.9,
  textDecoration: 'underline',
  textDecorationStyle: 'dotted',
  textUnderlineOffset: 2,
  ['&:hover']: {
    color: theme.palette.primary.main,
    textDecorationStyle: 'solid'
  }
}))

const AssetDetails = styled('dl')(({ theme }) => ({
  width: '100%',
  maxWidth: 440,
  textAlign: 'left',
  margin: theme.spacing(2, 0, 0),
  ['& dt']: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.pxToRem(13),
    marginTop: theme.spacing(1)
  },
  ['& dd']: {
    margin: 0,
    fontFamily: 'monospace',
    fontSize: theme.typography.pxToRem(14),
    overflowWrap: 'anywhere'
  }
}))

export { AssetDetails, RecipientExplorerLink }
