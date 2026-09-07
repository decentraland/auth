import { Box, Typography, styled } from 'decentraland-ui2'

const Content = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  marginTop: theme.spacing(4),
  maxWidth: theme.spacing(100),
  textAlign: 'left',
  width: '100%'
}))

// Signed domain values are shown whole: spacing kept as signed, wrapped rather than clipped, since a
// name with a run of spaces or a long version is part of what the user signs.
const signedText = {
  minWidth: 0,
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap'
} as const

// Labels the page adds itself, never signed content.
const DomainKey = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  flexShrink: 0,
  fontSize: theme.typography.pxToRem(13)
}))

const DomainName = styled(Typography)(({ theme }) => ({
  ...signedText,
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(13),
  fontWeight: 600
}))

const DomainRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  justifyContent: 'space-between'
}))

const DomainValue = styled(Typography)(({ theme }) => ({
  ...signedText,
  color: theme.palette.text.primary,
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(13),
  textAlign: 'right'
}))

const ContractLink = styled('a')(({ theme }) => ({
  ...signedText,
  color: theme.palette.text.primary,
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(13),
  textAlign: 'right',
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

const FieldLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(12),
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase'
}))

const MessageBlock = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.action.hover,
  borderRadius: theme.shape.borderRadius,
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(13),
  maxHeight: theme.spacing(40),
  overflow: 'auto',
  padding: theme.spacing(2),
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word'
}))

const MethodChip = styled(Box)(({ theme }) => ({
  alignSelf: 'flex-start',
  backgroundColor: theme.palette.action.selected,
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.text.secondary,
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(12),
  padding: theme.spacing(0.5, 1.5)
}))

const Notice = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(13),
  lineHeight: 1.4
}))

const RawToggle = styled('button')(({ theme }) => ({
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

const Section = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1)
}))

const TreeKey = styled('span')(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontWeight: 600
}))

const TreeNode = styled(Box)<{ depth: number }>(({ theme, depth }) => ({
  display: 'flex',
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(13),
  gap: theme.spacing(1),
  paddingLeft: theme.spacing(depth * 2)
}))

// Signed text is shown with its spacing intact: runs of spaces are part of what is signed, and the review
// escapes every character that could break a line or hide itself, so nothing here can wrap by surprise.
const TreeValue = styled('span')(({ theme }) => ({
  color: theme.palette.text.primary,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word'
}))

export {
  ContractLink,
  Content,
  DomainKey,
  DomainName,
  DomainRow,
  DomainValue,
  FieldLabel,
  MessageBlock,
  MethodChip,
  Notice,
  RawToggle,
  Section,
  TreeKey,
  TreeNode,
  TreeValue
}
