import { Box, muiIcons, styled } from 'decentraland-ui2'

const WarningAmberOutlinedIcon = muiIcons.WarningAmberOutlined

const ErrorContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '4px'
})

const ErrorText = styled('span')({
  color: 'rgba(224, 0, 0, 1)',
  fontSize: '14px'
})

const WarningIcon = styled(WarningAmberOutlinedIcon)({
  color: 'rgba(224, 0, 0, 1)',
  height: '15px',
  width: '15px'
})

const ErrorMessageIcon = styled(muiIcons.ErrorOutline)({
  color: '#fb3b3b'
})

export { ErrorContainer, ErrorText, WarningIcon, ErrorMessageIcon }
