import { Box, styled } from 'decentraland-ui2'

const AssetImageWrapper = styled(Box, { shouldForwardProp: prop => prop !== 'isGift' })<{ isGift?: boolean }>(({ isGift, theme }) => ({
  borderRadius: '16px',
  height: '328px',
  width: isGift ? '328px' : '470px',
  maxWidth: isGift ? '328px' : '470px',
  minWidth: isGift ? '328px' : '470px',
  overflow: 'hidden',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: isGift ? theme.spacing(10) : theme.spacing(2.5)
}))

const StyledRawImage = styled('img')({
  display: 'block',
  height: 'auto',
  width: '100%'
})

export { AssetImageWrapper, StyledRawImage }
