import { ReactNode } from 'react'
import { Box, styled } from 'decentraland-ui2'
import customWelcomeBackground from '../../../../assets/images/background/custom-welcome-background.webp'

const Background = styled('div')({
  position: 'fixed',
  height: '100vh',
  width: '100vw',
  backgroundSize: 'cover',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right',
  backgroundImage: `url(${customWelcomeBackground})`
})

const Main = styled(Box)({
  fontFamily: "system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  color: 'var(--text)',
  position: 'absolute',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  width: '100%',
  padding: '20px'
})

export const NFTTransferContainer = (props: { children: ReactNode }) => {
  const { children } = props

  return (
    <div>
      <Background />
      <Main>{children}</Main>
    </div>
  )
}
