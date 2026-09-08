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

const CallLine = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(15)
}))

const DomainKey = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(13)
}))

const DomainRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  justifyContent: 'space-between'
}))

const DomainValue = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(13),
  overflow: 'hidden',
  textOverflow: 'ellipsis'
}))

const ContractLink = styled('a')(({ theme }) => ({
  color: theme.palette.text.primary,
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(13),
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

export { CallLine, Content, ContractLink, DomainKey, DomainRow, DomainValue, MessageBlock, MethodChip, Notice, RawToggle }
