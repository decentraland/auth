import { styled, Box } from 'decentraland-ui2'

const Container = styled(Box)({
  display: 'flex',
  height: '100vh',
  width: '100vw',
  position: 'relative'
})

const Wrapper = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100%',
  width: '100%'
})

export { Container, Wrapper }
