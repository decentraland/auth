import { Alert, Box, Tabs, Typography, styled } from 'decentraland-ui2'

const Content = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
  marginTop: theme.spacing(3),
  maxWidth: theme.spacing(100),
  textAlign: 'left',
  width: '100%'
}))

const Intro = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(17),
  lineHeight: 1.45
}))

const TabBar = styled(Tabs)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  minHeight: theme.spacing(5)
}))

const Panel = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2)
}))

const Facts = styled('dl')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'max-content 1fr',
  columnGap: theme.spacing(3),
  rowGap: theme.spacing(1),
  margin: 0
}))

const FactKey = styled('dt')(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(13)
}))

const FactValue = styled('dd')(({ theme }) => ({
  color: theme.palette.text.primary,
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(13),
  margin: 0,
  overflowWrap: 'anywhere'
}))

const SelfNote = styled('span')(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontFamily: theme.typography.fontFamily,
  marginLeft: theme.spacing(1)
}))

const ExplorerLink = styled('a')(({ theme }) => ({
  color: theme.palette.text.primary,
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

const WarningsAlert = styled(Alert)(({ theme }) => ({
  textAlign: 'left',
  ['& ul']: {
    margin: theme.spacing(0.5, 0, 0),
    paddingLeft: theme.spacing(2.5)
  },
  ['& li + li']: {
    marginTop: theme.spacing(0.5)
  }
}))

const WarningsTitle = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(12),
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase'
}))

const RawLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(12),
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase'
}))

const RawBlock = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.action.hover,
  borderRadius: theme.shape.borderRadius,
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(13),
  maxHeight: theme.spacing(40),
  overflow: 'auto',
  padding: theme.spacing(2),
  unicodeBidi: 'plaintext',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word'
}))

const Hint = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(13)
}))

export {
  Content,
  ExplorerLink,
  FactKey,
  FactValue,
  Facts,
  Hint,
  Intro,
  Panel,
  RawBlock,
  RawLabel,
  SelfNote,
  TabBar,
  WarningsAlert,
  WarningsTitle
}
