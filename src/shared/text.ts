const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

/** Shortens an address for display to its first 6 and last 4 characters. Empty for a missing address. */
const shortenAddress = (address: string | null | undefined): string => {
  if (!address) return ''
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

export { capitalize, shortenAddress }
