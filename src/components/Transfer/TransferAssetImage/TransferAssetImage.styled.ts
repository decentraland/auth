import { Box, styled } from 'decentraland-ui2'

// The compact frame exists for the screens that have more than an item to state. A tip or a gift says who
// and what, and can give the item the room; a purchase also has to show a price, a recipient and the
// contracts, and all of it has to fit one screen, because an approval whose buttons sit below the fold asks
// for a decision about something the user has not read.
const COMPACT_SIZE = '200px'

const AssetImageWrapper = styled(Box, { shouldForwardProp: prop => prop !== 'isGift' && prop !== 'compact' })<{
  isGift?: boolean
  compact?: boolean
}>(({ compact, isGift, theme }) => ({
  borderRadius: '16px',
  height: compact ? COMPACT_SIZE : '328px',
  width: compact ? COMPACT_SIZE : isGift ? '328px' : '470px',
  maxWidth: compact ? COMPACT_SIZE : isGift ? '328px' : '470px',
  minWidth: compact ? COMPACT_SIZE : isGift ? '328px' : '470px',
  overflow: 'hidden',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: compact ? theme.spacing(1) : isGift ? theme.spacing(10) : theme.spacing(2.5)
}))

const StyledRawImage = styled('img')({
  display: 'block',
  height: 'auto',
  width: '100%'
})

export { AssetImageWrapper, StyledRawImage }
