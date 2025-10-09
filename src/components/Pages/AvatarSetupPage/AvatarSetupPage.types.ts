import { createContentClient } from 'dcl-catalyst-client'
import { AuthIdentity } from '@dcl/crypto'

export interface AvatarSetupState {
  username: string
  email: string
  hasEmailError: boolean
  showWearablePreview: boolean
  isTermsChecked: boolean
  isEmailInherited: boolean
  hasWearablePreviewLoaded: boolean
}

export interface Color {
  r: number
  g: number
  b: number
  a: number
}

export interface AvatarShape {
  bodyShape: string
  eyeColor: Color
  skinColor: Color
  hairColor: Color
  wearables: string[]
}

export type ContentClient = ReturnType<typeof createContentClient>

export interface DeploymentParams {
  avatarShape: AvatarShape
  connectedAccount: string
  deploymentProfileName: string
  connectedAccountIdentity: AuthIdentity
}

export interface ContentHashes {
  [filename: string]: string
}

export interface CreateAvatarMetadataParams {
  avatarShape: AvatarShape
  connectedAccount: string
  deploymentProfileName: string
  contentHashes: ContentHashes
  bodyFileName: string
  face256FileName: string
}
