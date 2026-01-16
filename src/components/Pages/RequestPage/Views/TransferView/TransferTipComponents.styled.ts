import { Box, Typography, styled } from 'decentraland-ui2'

const SceneName = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(30),
  fontWeight: 600,
  marginTop: theme.spacing(2.5)
}))

const ColumnContainer = styled(Box)<{ alignItems?: 'center' | 'flex-start' | 'flex-end' }>(({ alignItems, theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: alignItems ?? 'center',
  gap: theme.spacing(1.25)
}))

export { SceneName, ColumnContainer }
