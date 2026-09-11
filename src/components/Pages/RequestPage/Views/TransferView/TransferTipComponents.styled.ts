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

// Where the place is: the parcel it occupies, or the world name that addresses it. Said plainly under the
// title, because this is the part of the block that identifies anything (see PlaceLocation).
const PlaceLocationName = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(16),
  fontWeight: 500,
  letterSpacing: '0.04em',
  marginTop: theme.spacing(1),
  textAlign: 'center'
}))

// What the place block is and is not. Directly under the place it qualifies, so the claim and its limit are
// read together rather than the claim alone — and legible over a bright background, which the secondary
// colour at reduced opacity was not: a note nobody can read states nothing.
const PlaceNote = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(14),
  lineHeight: 1.5,
  marginTop: theme.spacing(1),
  maxWidth: theme.spacing(55),
  opacity: 0.95,
  textAlign: 'center'
}))

export { SceneName, ColumnContainer, PlaceLocationName, PlaceNote }
