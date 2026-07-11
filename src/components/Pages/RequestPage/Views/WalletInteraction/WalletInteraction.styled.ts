import { Box, Typography, styled } from 'decentraland-ui2'

const SummaryBody = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(4),
  textAlign: 'left',
  width: '100%'
}))

const GasInfo = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  marginTop: theme.spacing(2),
  textAlign: 'left',
  width: '100%'
}))

const GasLine = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(14)
}))

export { GasInfo, GasLine, SummaryBody }
