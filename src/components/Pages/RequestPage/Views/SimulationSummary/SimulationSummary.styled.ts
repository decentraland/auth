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

const UnavailableNote = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(13)
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
  flex: 1,
  flexDirection: 'column',
  minWidth: 0
})

const DirectionIndicator = styled('span')<{ outgoing?: boolean }>(({ theme, outgoing }) => ({
  color: outgoing ? theme.palette.warning.main : theme.palette.success.main,
  flexShrink: 0,
  fontWeight: 700
}))

const AmountUsd = styled('span')(({ theme }) => ({
  color: theme.palette.text.secondary,
  flexShrink: 0,
  fontSize: theme.typography.pxToRem(13),
  paddingLeft: theme.spacing(1),
  whiteSpace: 'nowrap'
}))

const VerifiedBadge = styled('span')(({ theme }) => ({
  color: theme.palette.success.main,
  fontSize: theme.typography.pxToRem(11),
  fontWeight: 600,
  marginLeft: theme.spacing(0.5),
  whiteSpace: 'nowrap'
}))

const RiskIcon = styled('span')(({ theme }) => ({
  color: theme.palette.error.main,
  marginRight: theme.spacing(0.5)
}))

const ExplorerLink = styled('a')(({ theme }) => ({
  color: 'inherit',
  textDecoration: 'underline',
  textDecorationStyle: 'dotted',
  textUnderlineOffset: 2,
  ['&:hover']: {
    color: theme.palette.primary.main,
    textDecorationStyle: 'solid'
  },
  ['&:focus-visible']: {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2
  }
}))

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

const NetLine = styled(Typography)(({ theme }) => ({
  borderTop: `1px solid ${theme.palette.divider}`,
  color: theme.palette.text.secondary,
  display: 'flex',
  fontSize: theme.typography.pxToRem(13),
  justifyContent: 'space-between',
  paddingTop: theme.spacing(1)
}))

const NetValue = styled('span')<{ negative?: boolean }>(({ theme, negative }) => ({
  color: negative ? theme.palette.error.main : theme.palette.success.main,
  fontWeight: 600
}))

const Toggle = styled('button')(({ theme }) => ({
  alignSelf: 'flex-start',
  background: 'none',
  border: 'none',
  color: theme.palette.primary.main,
  cursor: 'pointer',
  fontSize: theme.typography.pxToRem(13),
  padding: 0,
  textDecoration: 'underline',
  ['&:focus-visible']: {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2
  }
}))

const EventList = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5)
}))

const EventRow = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(12),
  overflow: 'hidden',
  textOverflow: 'ellipsis'
}))

export {
  AmountUsd,
  ApprovalLine,
  ApprovalsAlert,
  ChangeAmount,
  ChangeMeta,
  ChangeRow,
  ChangeText,
  DirectionIndicator,
  EventList,
  EventRow,
  ExplorerLink,
  LoadingRow,
  NetLine,
  NetValue,
  RiskIcon,
  Root,
  Section,
  SectionTitle,
  Toggle,
  TokenLogo,
  TokenLogoFallback,
  UnavailableNote,
  VerifiedBadge
}
