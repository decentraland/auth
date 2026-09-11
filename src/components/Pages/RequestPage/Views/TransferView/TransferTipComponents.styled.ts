import { Box, Typography, styled } from 'decentraland-ui2'

// Written by whoever deployed the scene: isolated so it cannot reorder the line, wrapped so it cannot overflow.
const SceneName = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(30),
  fontWeight: 600,
  marginTop: theme.spacing(2.5),
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  unicodeBidi: 'isolate'
}))

const ColumnContainer = styled(Box)<{ alignItems?: 'center' | 'flex-start' | 'flex-end' }>(({ alignItems, theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: alignItems ?? 'center',
  gap: theme.spacing(1.25)
}))

// The place's identity and what it is worth, as one block. Set on a panel of its own because these screens
// are bright: text alone was washed out against them, and this is the part the user is asked to check
// rather than admire. Dark and translucent, as the Cancel button on the same screens already is.
const PlaceDetails = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.45)',
  borderRadius: theme.spacing(1.5),
  display: 'flex',
  flexDirection: 'column',
  marginTop: theme.spacing(2),
  maxWidth: theme.spacing(58),
  padding: theme.spacing(1.75, 2.5)
}))

// Where the place is: the parcel it occupies, or the world name that addresses it. The line the user is
// meant to compare with where they actually are, so it leads the panel (see PlaceLocation).
const PlaceLocationName = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(17),
  fontWeight: 600,
  letterSpacing: '0.04em',
  textAlign: 'center'
}))

// What that identity is worth: which half of the block is established and which is not. Under the location
// it qualifies, so the claim and its limit are read together rather than the claim alone.
const PlaceNote = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(13),
  lineHeight: 1.5,
  marginTop: theme.spacing(0.75),
  opacity: 0.85,
  textAlign: 'center'
}))

export { SceneName, ColumnContainer, PlaceDetails, PlaceLocationName, PlaceNote }
