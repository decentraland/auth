import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'

export function isProfileComplete(profile: Profile) {
  return profile.avatars?.[0]?.name !== undefined
}
