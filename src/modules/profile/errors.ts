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

export { DeploymentError }
