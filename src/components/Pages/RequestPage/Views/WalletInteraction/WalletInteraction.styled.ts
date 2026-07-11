import { Box, styled } from 'decentraland-ui2'

const SummaryCard = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  margin: '0 auto',
  maxWidth: theme.spacing(110),
  textAlign: 'center',
  width: '100%'
}))

const SummaryBody = styled(Box)({
  textAlign: 'left',
  width: '100%'
})

const AckRow = styled(Box)(({ theme }) => ({
  alignSelf: 'flex-start',
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(13),
  textAlign: 'left'
}))

export { AckRow, SummaryBody, SummaryCard }
