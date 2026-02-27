import { AuthIdentity } from '@dcl/crypto'

interface AvatarSetupState {
  username: string
  email: string
  hasEmailError: boolean
  showWearablePreview: boolean
  isTermsChecked: boolean
  isEmailInherited: boolean
  hasWearablePreviewLoaded: boolean
}

interface Color {
  r: number
  g: number
  b: number
  a: number
}

interface AvatarShape {
  bodyShape: string
  eyeColor: Color
  skinColor: Color
  hairColor: Color
  wearables: string[]
}

interface DeploymentParams {
  avatarShape: AvatarShape
  connectedAccount: string
  deploymentProfileName: string
  connectedAccountIdentity: AuthIdentity
}

interface CreateAvatarMetadataParams {
  avatarShape: AvatarShape
  connectedAccount: string
  deploymentProfileName: string
}

export type { AvatarSetupState, Color, AvatarShape, DeploymentParams, CreateAvatarMetadataParams }
