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

// What the place block is and is not. Small and directly under the place it qualifies, so the claim and
// its limit are read together rather than the claim alone.
const PlaceNote = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(13),
  marginTop: theme.spacing(1),
  maxWidth: theme.spacing(55),
  opacity: 0.8,
  textAlign: 'center'
}))

export { SceneName, ColumnContainer, PlaceNote }
