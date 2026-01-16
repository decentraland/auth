import { Typography, styled } from 'decentraland-ui2'

const SceneName = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(30),
  fontWeight: 600,
  marginTop: theme.spacing(2.5)
}))

export { SceneName }
