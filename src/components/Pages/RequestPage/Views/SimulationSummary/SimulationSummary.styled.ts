import { Alert, Box, Typography, styled } from 'decentraland-ui2'

const Root = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  textAlign: 'left',
  width: '100%'
}))

const LoadingRow = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  color: theme.palette.text.secondary,
  display: 'flex',
  fontSize: theme.typography.pxToRem(14),
  gap: theme.spacing(1.5)
}))

const Section = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1)
}))

const SectionTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(12),
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase'
}))

const ChangeRow = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  backgroundColor: theme.palette.action.hover,
  borderRadius: theme.shape.borderRadius,
  display: 'flex',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5)
}))

const TokenLogo = styled('img')(({ theme }) => ({
  borderRadius: '50%',
  height: theme.spacing(5),
  objectFit: 'cover',
  width: theme.spacing(5)
}))

const TokenLogoFallback = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  backgroundColor: theme.palette.action.selected,
  borderRadius: '50%',
  color: theme.palette.text.primary,
  display: 'flex',
  fontWeight: 600,
  height: theme.spacing(5),
  justifyContent: 'center',
  textTransform: 'uppercase',
  width: theme.spacing(5)
}))

const ChangeText = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0
})

const ChangeAmount = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis'
}))

const ChangeMeta = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(12),
  overflow: 'hidden',
  textOverflow: 'ellipsis'
}))

const ApprovalsAlert = styled(Alert)(({ theme }) => ({
  textAlign: 'left',
  ['& .MuiAlert-message']: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5)
  }
}))

const ApprovalLine = styled('span')<{ emphasized?: boolean }>(({ theme, emphasized }) => ({
  color: emphasized ? theme.palette.error.main : 'inherit',
  fontWeight: emphasized ? 700 : 400
}))

export {
  ApprovalLine,
  ApprovalsAlert,
  ChangeAmount,
  ChangeMeta,
  ChangeRow,
  ChangeText,
  LoadingRow,
  Root,
  Section,
  SectionTitle,
  TokenLogo,
  TokenLogoFallback
}
