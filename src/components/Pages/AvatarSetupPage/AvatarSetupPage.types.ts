import { AuthIdentity } from '@dcl/crypto'

interface AvatarSetupState {
  username: string
  email: string
  hasEmailError: boolean
  showWearablePreview: boolean
  isTermsChecked: boolean
  isEmailInherited: boolean
  // Consent for the marketing newsletter when the email was inherited from a web2 login. Only
  // meaningful while isEmailInherited is true; when the user types their own email, entering it in
  // the newsletter field is itself the opt-in (mirrors QuickSetupPage).
  subscribeNewsletter: boolean
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
  disabledCatalysts?: string[]
}

interface CreateAvatarMetadataParams {
  avatarShape: AvatarShape
  connectedAccount: string
  deploymentProfileName: string
}

enum CustomizationStep {
  PRESET_SELECTION = 0,
  FACE_SELECTION = 1,
  BODY_SELECTION = 2,
  CONFIRMATION = 3
}

const CUSTOMIZATION_STEP_NAMES: Record<CustomizationStep, string> = {
  [CustomizationStep.PRESET_SELECTION]: 'preset_selection',
  [CustomizationStep.FACE_SELECTION]: 'face_selection',
  [CustomizationStep.BODY_SELECTION]: 'body_selection',
  [CustomizationStep.CONFIRMATION]: 'confirmation'
}

export { CustomizationStep, CUSTOMIZATION_STEP_NAMES }
export type { AvatarSetupState, Color, AvatarShape, DeploymentParams, CreateAvatarMetadataParams }
