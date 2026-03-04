const THIRTY_SECONDS = 30 * 1000
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export { THIRTY_SECONDS, wait }
