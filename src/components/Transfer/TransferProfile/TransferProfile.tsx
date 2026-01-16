import { Profile as ProfileComponent } from 'decentraland-ui2'
import { ProfileContainer } from './TransferProfile.styled'
import { TransferProfileProps } from './TransferProfile.types'

const TransferProfile = ({ withContainer = true, ...props }: TransferProfileProps) => {
  const profile = <ProfileComponent size="normal" {...props} />

  return withContainer ? <ProfileContainer>{profile}</ProfileContainer> : profile
}

export { TransferProfile }
