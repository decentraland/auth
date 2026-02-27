import { Box, Typography, styled } from 'decentraland-ui2'

const LoadingContainer = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'row',
  gap: theme.spacing(2),
  marginTop: theme.spacing(3)
}))

const LoadingText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  lineHeight: '100%'
}))

export { LoadingContainer, LoadingText }
