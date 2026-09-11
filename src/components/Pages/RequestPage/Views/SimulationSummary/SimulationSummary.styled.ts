import { Alert, Box, Typography, dclColors, styled } from 'decentraland-ui2'

const Root = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  textAlign: 'left',
  width: '100%'
}))

const LoadingRow = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  color: theme.palette.text.primary,
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
  color: theme.palette.text.primary,
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
  color: theme.palette.text.primary,
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
  color: theme.palette.text.primary,
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
  color: theme.palette.error.light,
  marginRight: theme.spacing(0.5)
}))

const NetworkChip = styled('span')(({ theme }) => ({
  alignSelf: 'flex-start',
  backgroundColor: theme.palette.action.selected,
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(12),
  padding: theme.spacing(0.25, 1)
}))

const SkeletonRow = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  display: 'flex',
  gap: theme.spacing(1.5)
}))

// The address a name belongs to, beside it. Subdued, since the name is what is read first, and never
// wrapped away from it.
// The name and the address it belongs to, laid out so the address is the part that survives. The row clips
// what overflows it, and a long name is a single unbreakable box: left to itself it pushed the address out
// of the visible area entirely, which left the half anyone can set standing alone — the opposite of what
// showing them together is for. So the name shrinks and takes the ellipsis, and the address does not.
const CounterpartyPair = styled('span')({
  display: 'inline-flex',
  flexWrap: 'wrap',
  maxWidth: '100%',
  minWidth: 0,
  verticalAlign: 'bottom'
})

const CounterpartyName = styled('span')({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
})

const CounterpartyAddress = styled('span')(({ theme }) => ({
  color: theme.palette.text.secondary,
  flexShrink: 0,
  marginLeft: theme.spacing(0.75),
  opacity: 0.8,
  whiteSpace: 'nowrap'
}))

const ExplorerLink = styled('a')(({ theme }) => ({
  color: 'inherit',
  textDecoration: 'underline',
  textDecorationStyle: 'dotted',
  textUnderlineOffset: 2,
  whiteSpace: 'nowrap',
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
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(12),
  overflow: 'hidden',
  textOverflow: 'ellipsis'
}))

const RevertAlert = styled(Alert)(({ theme }) => ({
  alignItems: 'flex-start',
  backgroundColor: dclColors.blackTransparent.backdrop,
  border: `1px solid ${theme.palette.error.main}`,
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.text.primary,
  textAlign: 'left',
  ['& .MuiAlert-icon']: {
    alignItems: 'center',
    color: theme.palette.error.light
  },
  ['& .MuiAlert-message']: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    width: '100%'
  }
}))

const ApprovalsAlert = styled(Alert)(({ theme }) => ({
  alignItems: 'flex-start',
  backgroundColor: dclColors.blackTransparent.backdrop,
  border: `1px solid ${theme.palette.warning.main}`,
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.text.primary,
  textAlign: 'left',
  ['& .MuiAlert-icon']: {
    alignItems: 'center',
    color: theme.palette.warning.light
  },
  ['& .MuiAlert-message']: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    width: '100%'
  }
}))

const ApprovalLine = styled('span')<{ emphasized?: boolean }>(({ theme, emphasized }) => ({
  color: emphasized ? theme.palette.error.light : 'inherit',
  fontWeight: emphasized ? 700 : 400
}))

// One approval: the sentence and, beneath it, the token contract the permission is over.
const ApprovalItemBlock = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.25)
}))

// The token contract an approval is over, on its own line under the sentence. Never emphasized with the
// sentence: which contract it is stays legible whether or not the permission trips the risk warning.
const ApprovalMeta = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(12),
  fontWeight: 400,
  overflow: 'hidden',
  textOverflow: 'ellipsis'
}))

const NetLine = styled(Typography)(({ theme }) => ({
  borderTop: `1px solid ${theme.palette.divider}`,
  color: theme.palette.text.primary,
  display: 'flex',
  fontSize: theme.typography.pxToRem(13),
  justifyContent: 'space-between',
  paddingTop: theme.spacing(1)
}))

const NetValue = styled('span')<{ negative?: boolean }>(({ theme, negative }) => ({
  color: negative ? theme.palette.error.main : theme.palette.success.main,
  fontWeight: 600
}))

const GasFooter = styled(Box)(({ theme }) => ({
  borderTop: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  paddingTop: theme.spacing(1)
}))

const GasNote = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(13)
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
  color: theme.palette.text.primary,
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(12),
  overflow: 'hidden',
  textOverflow: 'ellipsis'
}))

export {
  AmountUsd,
  ApprovalItemBlock,
  ApprovalLine,
  ApprovalMeta,
  ApprovalsAlert,
  ChangeAmount,
  ChangeMeta,
  ChangeRow,
  ChangeText,
  DirectionIndicator,
  EventList,
  EventRow,
  CounterpartyAddress,
  CounterpartyName,
  CounterpartyPair,
  ExplorerLink,
  GasFooter,
  GasNote,
  LoadingRow,
  NetLine,
  NetValue,
  NetworkChip,
  RevertAlert,
  RiskIcon,
  Root,
  Section,
  SectionTitle,
  SkeletonRow,
  Toggle,
  TokenLogo,
  TokenLogoFallback,
  UnavailableNote,
  VerifiedBadge
}
