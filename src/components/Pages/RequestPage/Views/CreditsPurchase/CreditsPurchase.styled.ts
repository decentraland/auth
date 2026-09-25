import { Accordion, AccordionDetails, AccordionSummary, Box, Typography, styled } from 'decentraland-ui2'
import { CenteredContent, Title } from '../../../../Transfer/Transfer.styled'

// The branded transfer screens size their content for a desktop window: a fixed 36px title, a column that is
// only as wide as it wants to be, and a 520px button row. A purchase screen also carries a 42-character
// address and a block of contract addresses, and it is reached from a phone as often as from a laptop, so
// the same content has to survive a 390px viewport. These narrow the shared pieces for this screen alone:
// nothing here changes how a tip or a gift is laid out.
const PurchaseContent = styled(CenteredContent)({
  maxWidth: 'min(600px, 100%)',
  width: '100%'
})

const PurchaseTitle = styled(Title)(({ theme }) => ({
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  [theme.breakpoints.down('sm')]: {
    fontSize: theme.typography.pxToRem(28)
  }
}))

// The price, and the largest thing on the screen after the item itself: what the user is agreeing to spend.
const Price = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(32),
  fontWeight: 700,
  lineHeight: '100%'
}))

// The mark and the amount on one line, the way a price is written everywhere else in Decentraland. The mark
// is centred against the digits rather than the line box, so it does not ride high over a large number.
const PriceRow = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  display: 'flex',
  gap: theme.spacing(1),
  justifyContent: 'center',
  marginTop: theme.spacing(1)
}))

// The line under the price that says what the number is. Quieter than the price by size, not by colour: the
// bright background these screens use washes a reduced-opacity secondary colour out (see Transfer.styled).
const PriceLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(16),
  fontWeight: 400,
  letterSpacing: '0.08em',
  opacity: 0.95,
  textTransform: 'uppercase'
}))

// The identifiers an item is named by when its cosmetic details could not be read. Monospace, because what
// it holds is an address and a number the user may want to compare character by character.
const AssetIdentifiers = styled(Box)(({ theme }) => ({
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(13),
  marginTop: theme.spacing(1),
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  opacity: 0.8
}))

// The address goes on screen in full — it is the fact the line exists for — so it wraps rather than being
// cut off or pushing the screen sideways.
const RecipientLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(16),
  fontWeight: 400,
  letterSpacing: '0.08em',
  marginTop: theme.spacing(4),
  maxWidth: '100%',
  opacity: 0.95,
  overflowWrap: 'anywhere'
}))

// The whole facts block: the price, what it buys, and where it goes, laid out in one column.
const PurchaseFacts = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  marginTop: theme.spacing(3),
  maxWidth: '100%'
}))

// Everything the screen does not need to say to be understood, folded away: the contracts, the raw amounts,
// the expiries. Collapsed by default so the facts above stay the screen, open to anyone who wants to check
// them against the payload.
const DetailsAccordion = styled(Accordion)(({ theme }) => ({
  backgroundColor: 'transparent',
  backgroundImage: 'none',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  boxShadow: 'none',
  marginTop: theme.spacing(4),
  maxWidth: '100%',
  width: '100%',
  ['&::before']: { display: 'none' }
}))

const DetailsSummary = styled(AccordionSummary)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(14),
  minHeight: theme.spacing(5),
  ['& .MuiAccordionSummary-content']: { justifyContent: 'center', margin: theme.spacing(1, 0) }
}))

const DetailsBody = styled(AccordionDetails)({
  paddingTop: 0,
  textAlign: 'left'
})

// One fact: its name, and its value in monospace so an address or an amount can be read character by
// character. Wraps rather than truncating — a value the user cannot see whole is a value they cannot check.
const DetailRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.25),
  marginTop: theme.spacing(1.5)
}))

const DetailLabel = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(12),
  letterSpacing: '0.06em',
  opacity: 0.7,
  textTransform: 'uppercase'
}))

const DetailValue = styled(Box)(({ theme }) => ({
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(13),
  overflowWrap: 'anywhere',
  unicodeBidi: 'isolate'
}))

export {
  AssetIdentifiers,
  DetailLabel,
  DetailRow,
  DetailValue,
  DetailsAccordion,
  DetailsBody,
  DetailsSummary,
  Price,
  PriceLabel,
  PriceRow,
  PurchaseContent,
  PurchaseFacts,
  PurchaseTitle,
  RecipientLabel
}
