import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { formatUntrustedLabel } from './text'

function isProfileComplete(profile: Profile) {
  return profile.avatars?.[0]?.name !== undefined
}

/**
 * The name a profile is shown under next to an address, or null when it has none.
 *
 * A claimed name is unique (it is an NFT) and stands on its own. An unclaimed name is free text anyone
 * can set, so it is qualified with the last four characters of the address, the way decentraland-ui2's
 * Profile component renders it. Without the qualifier a wallet that named itself "Decentraland" would
 * be shown as the counterparty "Decentraland".
 *
 * The name is formatted before it is qualified, since it is the profile owner's own text: the schema puts
 * no length or character limit on it, and a name carrying a right-to-left override or made of a thousand
 * characters would otherwise reorder or push aside the lines it sits among. Formatting first also keeps
 * the qualifier: it is appended after any truncation, so it cannot be the part that is cut. Callers that
 * take profiles from `fetchProfile` are handed formatted names already; doing it here as well means a
 * profile from anywhere else cannot arrive on a screen unformatted.
 */
function getProfileDisplayName(profile: Profile | null | undefined, address: string): string | null {
  const avatar = profile?.avatars?.[0]
  const name = formatUntrustedLabel(avatar?.name)
  if (!name) {
    return null
  }
  if (avatar?.hasClaimedName) {
    return name
  }
  const suffix = `#${address.slice(-4)}`
  return name.endsWith(suffix) ? name : `${name}${suffix}`
}

export { isProfileComplete, getProfileDisplayName }
