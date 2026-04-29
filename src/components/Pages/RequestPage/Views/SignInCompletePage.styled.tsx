// eslint-disable-next-line @typescript-eslint/naming-convention
import Lottie from 'lottie-react'
import { Box, styled } from 'decentraland-ui2'

const CenteredContainer = styled(Box)({
  position: 'relative',
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 78
})

const SuccessAnimation = styled(Lottie)({
  width: 500,
  height: 500,
  flexShrink: 0,
  zIndex: 1,
  pointerEvents: 'none'
})

const TextBlock = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  zIndex: 1
})

const TitleRow = styled(Box)({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 18
})

const TitleCheckIcon = styled('svg')({
  width: 45.773,
  height: 45.773,
  flexShrink: 0,
  display: 'block'
})

const Title = styled('h1')({
  fontFamily: 'Inter, sans-serif',
  fontWeight: 600,
  fontSize: 48,
  lineHeight: 1.167,
  color: '#FCFCFC',
  margin: 0,
  whiteSpace: 'nowrap'
})

const Description = styled('p')({
  fontFamily: 'Inter, sans-serif',
  fontWeight: 500,
  fontSize: 24,
  lineHeight: 1.334,
  color: '#FCFCFC',
  margin: 0,
  textAlign: 'center',
  maxWidth: 595
})

export { CenteredContainer, Description, SuccessAnimation, TextBlock, Title, TitleCheckIcon, TitleRow }
