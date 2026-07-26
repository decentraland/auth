import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'

export function isProfileComplete(profile: Profile) {
  // A profile is only complete when it has a non-empty name. Treating an empty or whitespace-only
  // name (or null) as complete would let an effectively unnamed user skip onboarding.
  const name = profile.avatars?.[0]?.name
  return typeof name === 'string' && name.trim().length > 0
}
