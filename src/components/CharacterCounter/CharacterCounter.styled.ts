import { Box, muiIcons, styled, Typography } from 'decentraland-ui2'

const WarningAmberOutlinedIcon = muiIcons.WarningAmberOutlined

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

const WarningIcon = styled(WarningAmberOutlinedIcon)({
  color: 'rgba(224, 0, 0, 1)',
  height: '15px',
  width: '15px'
})

const ErrorText = styled('span')({
  color: 'rgba(224, 0, 0, 1)',
  fontSize: '14px'
})

export { CharacterCounter, CharacterCounterText, WarningIcon, ErrorText }
