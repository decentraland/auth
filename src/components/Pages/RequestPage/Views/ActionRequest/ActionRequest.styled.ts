import { Alert, Box, Typography, styled } from 'decentraland-ui2'

const Content = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  marginTop: theme.spacing(3),
  maxWidth: theme.spacing(100),
  textAlign: 'left',
  width: '100%'
}))

// The one sentence that says what is happening, under the title and before anything is shown. Runs the full
// width of the column: balanced wrapping would shorten its lines and make it read as a caption.
const Statement = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(20),
  fontWeight: 400,
  lineHeight: 1.4,
  marginTop: theme.spacing(2),
  textAlign: 'left',
  width: '100%',
  [theme.breakpoints.down('sm')]: {
    fontSize: theme.typography.pxToRem(17)
  }
}))

// What a malicious request could do, listed right above the consent so it is the last thing read before ticking.
const WarningBox = styled(Alert)(({ theme }) => ({
  alignItems: 'flex-start',
  textAlign: 'left',
  ['& .MuiAlert-message']: {
    width: '100%'
  },
  ['& ul']: {
    margin: theme.spacing(0.75, 0, 0),
    paddingLeft: theme.spacing(2.5)
  },
  ['& li + li']: {
    marginTop: theme.spacing(0.5)
  }
}))

const WarningTitle = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(12),
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase'
}))

// The consent, framed as a decision of its own rather than a line of text after the payload: bordered,
// with the checkbox top-aligned to a label that runs several lines.
const ConsentBox = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1.5, 2),
  ['& .MuiFormControlLabel-root']: {
    alignItems: 'flex-start',
    margin: 0
  },
  ['& .MuiCheckbox-root']: {
    marginTop: theme.spacing(-1)
  },
  ['& .MuiFormControlLabel-label']: {
    fontSize: theme.typography.pxToRem(15),
    fontWeight: 500,
    lineHeight: 1.45
  }
}))

// The method the wallet will be asked, beside its label: monospace, because it is an identifier the reader
// may need to compare character by character (`eth_signTypedData_v3` against `_v4`).
const MethodRow = styled(Box)(({ theme }) => ({
  alignItems: 'baseline',
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(0, 1)
}))

const MethodValue = styled('span')(({ theme }) => ({
  color: theme.palette.text.primary,
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(13),
  overflowWrap: 'anywhere'
}))

const PayloadLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(13)
}))

// Frames the payload so a fade can sit over its bottom edge while there is more below the fold: phones
// draw no scrollbar, so without it a payload cut exactly at a line break would look complete.
const PayloadFrame = styled('div')<{ more?: boolean }>(({ theme, more }) => ({
  position: 'relative',
  ['&::after']: {
    borderRadius: `0 0 ${theme.shape.borderRadius}px ${theme.shape.borderRadius}px`,
    background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.45))',
    bottom: 0,
    content: '""',
    height: theme.spacing(6),
    left: 0,
    opacity: more ? 1 : 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    transition: theme.transitions.create('opacity', { duration: theme.transitions.duration.short })
  }
}))

// Everything the wallet will receive, whole, in a box of fixed height that scrolls rather than a page that
// grows: a payload can be as long as the requester likes, and the checkbox and the buttons must stay in
// reach below it. Shorter on phones so the sentence above and the checkbox below share the screen with it.
const PayloadBlock = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.action.hover,
  borderRadius: theme.shape.borderRadius,
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(13),
  height: theme.spacing(40),
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
  overflowX: 'hidden',
  overflowY: 'auto',
  padding: theme.spacing(2),
  unicodeBidi: 'plaintext',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  ['&:focus-visible']: {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2
  },
  [theme.breakpoints.down('sm')]: {
    fontSize: theme.typography.pxToRem(12),
    height: theme.spacing(30),
    padding: theme.spacing(1.5)
  }
}))

const Hint = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(13)
}))

export { ConsentBox, Content, Hint, MethodRow, MethodValue, PayloadBlock, PayloadFrame, PayloadLabel, Statement, WarningBox, WarningTitle }
