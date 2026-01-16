import { Box, Profile, styled } from 'decentraland-ui2'

const ProfileContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(8)
}))

const StyledProfile = styled(Profile)(({ theme }) => ({
  ['& .MuiAvatar-root']: {
    height: theme.spacing(10),
    width: theme.spacing(10)
  },
  ['& .MuiBox-root']: {
    alignItems: 'flex-start'
  },
  ['& .MuiBox-root > span:first-child']: {
    fontSize: theme.typography.pxToRem(26),
    fontWeight: 600,
    letterSpacing: '0px',
    lineHeight: '100%'
  },
  ['& .MuiBox-root .MuiBox-root span']: {
    fontSize: theme.typography.pxToRem(20),
    fontWeight: 400,
    letterSpacing: '0%',
    lineHeight: '100%',
    textAlign: 'center'
  }
}))

export { ProfileContainer, StyledProfile }
