import { Box, styled } from 'decentraland-ui2'

const LayoutRoot = styled(Box)({
  position: 'relative',
  height: '100vh'
})

// `scrollable` is for a screen whose content can grow past the viewport — one with an expandable block, or
// a long list of facts. Centring is then done by the child's auto margins rather than by `justify-content`:
// a flex column that centres its content clips it at BOTH ends once it overflows, and the top half becomes
// unreachable however far the box is scrolled. With `margin: auto` the content still sits in the middle
// when it fits, and scrolls whole when it does not. The screens that cannot overflow keep the old centring
// untouched.
const Main = styled(Box, { shouldForwardProp: prop => prop !== 'scrollable' })<{ scrollable?: boolean }>(({ scrollable, theme }) => ({
  alignItems: 'center',
  color: theme.palette.text.primary,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: theme.typography.fontFamily,
  height: '100%',
  justifyContent: scrollable ? 'flex-start' : 'center',
  overflowY: scrollable ? 'auto' : undefined,
  padding: theme.spacing(2),
  position: 'absolute',
  width: '100%',
  ...(scrollable ? { ['& > *']: { marginTop: 'auto', marginBottom: 'auto' } } : {})
}))

export { LayoutRoot, Main }
