import { Alert, Box, Typography, styled } from 'decentraland-ui2'

const CenteredContent = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  maxWidth: theme.spacing(75),
  textAlign: 'center',
  width: 'fit-content'
}))

// Written by the item's creator: isolated so it cannot reorder the line, wrapped so it cannot overflow.
const ItemName = styled(Box)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(22),
  fontWeight: 600,
  marginTop: theme.spacing(2.5),
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  unicodeBidi: 'isolate'
}))

// Over the bright background these screens use, the secondary text colour at reduced opacity came out too
// faint to read. It is the label for what sits under it, so it is kept quieter than a title by weight and
// size rather than by washing its colour out.
const Label = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(18),
  fontWeight: 400,
  letterSpacing: '0.08em',
  marginTop: theme.spacing(6.25),
  opacity: 0.95
}))

const Title = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(36),
  fontStyle: 'normal',
  fontWeight: 600,
  letterSpacing: '0px',
  lineHeight: '100%',
  marginBottom: theme.spacing(2.5),
  textAlign: 'center'
}))

// What sits between the item and the action buttons: the notices about the transfer, and the consent one of
// them may ask for. The buttons keep their own top margin for the screens that show none of this, so the
// group — not each notice — pulls them back up under whatever comes last. Putting that negative margin on a
// notice would drag the next sibling over it: the checkbox up into the warning it belongs to.
const Notices = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(-8),
  marginTop: theme.spacing(5),
  maxWidth: theme.spacing(100),
  width: '100%'
}))

const WarningAlert = styled(Alert)(({ theme }) => ({
  alignItems: 'center',
  alignSelf: 'center',
  backgroundColor: 'transparent',
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(18),
  justifyContent: 'center',
  width: '100%',
  ['& .MuiAlert-icon']: {
    alignItems: 'center',
    color: theme.palette.text.primary,
    marginRight: theme.spacing(1.5)
  }
}))

export { CenteredContent, ItemName, Label, Notices, Title, WarningAlert }
