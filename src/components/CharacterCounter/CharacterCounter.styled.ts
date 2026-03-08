import { Box, Typography, styled } from 'decentraland-ui2'
import { ErrorText, WarningIcon } from '../shared/ErrorDisplay.styled'

const CharacterCounter = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  marginTop: '8px',
  gap: '4px'
})

const CharacterCounterText = styled(Typography)<{ isError: boolean }>(({ isError }) => ({
  fontSize: '14px',
  color: isError ? 'rgba(224, 0, 0, 1)' : '#E5E7EB',
  margin: 0
}))

export { CharacterCounter, CharacterCounterText, WarningIcon, ErrorText }
