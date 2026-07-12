class DeploymentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | undefined,
    public readonly responseBody: string | undefined,
    public readonly catalystUrl: string
  ) {
    super(message)
    this.name = 'DeploymentError'
  }
}

/**
 * Thrown when the profile consistency check could not reach a conclusion because every
 * catalyst request failed transiently (network error / timeout / 5xx). It signals "we don't
 * know whether the user has a profile", which callers must handle by surfacing an error /
 * retry — never by routing the user into onboarding, which would overwrite an existing
 * profile with a default one.
 */
class ProfileFetchError extends Error {
  constructor(public readonly account: string) {
    super(`Could not determine the profile for ${account}: all catalyst requests failed`)
    this.name = 'ProfileFetchError'
  }
}

export { DeploymentError, ProfileFetchError }
