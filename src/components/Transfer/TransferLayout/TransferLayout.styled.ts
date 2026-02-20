import { Box, styled } from 'decentraland-ui2'

const LayoutRoot = styled(Box)({
  position: 'relative',
  height: '100vh'
})

const Main = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  color: theme.palette.text.primary,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: theme.typography.fontFamily,
  height: '100%',
  justifyContent: 'center',
  padding: theme.spacing(2),
  position: 'absolute',
  width: '100%'
}))

export { LayoutRoot, Main }
