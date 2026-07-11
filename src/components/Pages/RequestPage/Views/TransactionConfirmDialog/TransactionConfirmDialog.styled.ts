import { Box, Typography, styled } from 'decentraland-ui2'

const GasInfo = styled(Box)(({ theme }) => ({
  color: theme.palette.text.secondary,
  display: 'flex',
  flexDirection: 'column',
  fontSize: theme.typography.pxToRem(13),
  gap: theme.spacing(0.5)
}))

const GasLine = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(13)
}))

export { GasInfo, GasLine }
