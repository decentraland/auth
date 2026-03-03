import { Box, styled } from 'decentraland-ui2'

const Container = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: theme.zIndex.modal,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}))

const Content = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: theme.spacing(5)
}))

const Title = styled('p')(({ theme }) => ({
  color: theme.palette.common.white,
  fontSize: '28px',
  fontWeight: 500,
  margin: theme.spacing(3, 0, 0),
  letterSpacing: '0.5px'
}))

const Subtitle = styled('p')(({ theme }) => ({
  color: 'rgba(255, 255, 255, 0.85)',
  fontSize: '16px',
  margin: theme.spacing(1.5, 0, 0),
  maxWidth: '400px'
}))

const Spinner = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(3),
  color: '#fc9965'
}))

const RetryButton = styled('button')(({ theme }) => ({
  marginTop: theme.spacing(3),
  background: theme.palette.primary.main,
  color: theme.palette.common.white,
  border: 'none',
  borderRadius: '8px',
  padding: theme.spacing(1.75, 4),
  fontSize: '16px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '&:hover': {
    background: '#e6284d'
  }
}))

export { Container, Content, RetryButton, Spinner, Subtitle, Title }
