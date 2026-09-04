import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { getProfileDisplayName, isProfileComplete } from './profile'

const ADDRESS = '0x1111111111111111111111111111111111111234'

describe('isProfileComplete', () => {
  describe('when the first avatar has a name', () => {
    it('should return true', () => {
      expect(isProfileComplete({ avatars: [{ name: 'Someone' }] } as Profile)).toBe(true)
    })
  })

  describe('when the profile has no avatar name', () => {
    it('should return false', () => {
      expect(isProfileComplete({ avatars: [{}] } as Profile)).toBe(false)
    })
  })
})

describe('getProfileDisplayName', () => {
  describe('when the profile has a claimed name', () => {
    let profile: Profile

    beforeEach(() => {
      profile = { avatars: [{ name: 'Decentraland', hasClaimedName: true }] } as Profile
    })

    it('should return the name on its own because a claimed name is unique', () => {
      expect(getProfileDisplayName(profile, ADDRESS)).toBe('Decentraland')
    })
  })

  describe('when the profile has an unclaimed name', () => {
    let profile: Profile

    beforeEach(() => {
      profile = { avatars: [{ name: 'Decentraland', hasClaimedName: false }] } as Profile
    })

    it('should qualify the name with the last four characters of the address, as anyone can set it', () => {
      expect(getProfileDisplayName(profile, ADDRESS)).toBe('Decentraland#1234')
    })
  })

  describe('when the profile does not say whether the name is claimed', () => {
    let profile: Profile

    beforeEach(() => {
      profile = { avatars: [{ name: 'Decentraland' }] } as Profile
    })

    it('should treat the name as unclaimed', () => {
      expect(getProfileDisplayName(profile, ADDRESS)).toBe('Decentraland#1234')
    })
  })

  describe('when the unclaimed name already carries the address qualifier', () => {
    let profile: Profile

    beforeEach(() => {
      profile = { avatars: [{ name: 'Decentraland#1234', hasClaimedName: false }] } as Profile
    })

    it('should not add it twice', () => {
      expect(getProfileDisplayName(profile, ADDRESS)).toBe('Decentraland#1234')
    })
  })

  describe('when the profile has no name', () => {
    it.each([
      ['a null profile', null],
      ['a profile without avatars', {} as Profile],
      ['an avatar without a name', { avatars: [{}] } as Profile]
    ])('should return null for %s', (_label, profile) => {
      expect(getProfileDisplayName(profile, ADDRESS)).toBeNull()
    })
  })
})
