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

export { SceneName, ColumnContainer }
