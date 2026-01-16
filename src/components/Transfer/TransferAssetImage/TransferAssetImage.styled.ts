import { Box, styled } from 'decentraland-ui2'

const AssetImageWrapper = styled(Box)({
  borderRadius: '16px',
  height: '328px',
  width: '470px',
  overflow: 'hidden',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
})

const StyledRawImage = styled('img')({
  display: 'block',
  height: 'auto',
  width: '100%'
})

export { AssetImageWrapper, StyledRawImage }
