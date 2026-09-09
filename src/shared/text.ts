// Characters a reader cannot see, or that change how the text around them is laid out: controls other than
// tab, newline and carriage return (C0 and C1), format characters such as zero-width and bidi controls,
// surrogates, private-use and unassigned code points, and the line and paragraph separators. Defined by
// Unicode category rather than by enumerated ranges. The one pattern behind every rule that asks whether text
// can be read as it is shown.
const HIDDEN_CHARACTER_PATTERN = '(?![\\t\\n\\r])[\\p{C}\\p{Zl}\\p{Zp}]'
const HIDDEN_CHARACTER_REGEX = new RegExp(HIDDEN_CHARACTER_PATTERN, 'gu')

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

/** Shortens an address for display to its first 6 and last 4 characters. Empty for a missing address. */
const shortenAddress = (address: string | null | undefined): string => {
  if (!address) return ''
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

/**
 * Replaces every hidden character with its JSON `\uXXXX` escape (one per UTF-16 code unit), so text that
 * carries one reads as what it contains instead of being laid out by it: a right-to-left override inside a
 * value would otherwise mirror the rest of the line, and a zero-width character would vanish. Inside a JSON
 * string the escape denotes the same character, so escaped JSON still reads as the same document.
 */
const revealHiddenCharacters = (text: string): string =>
  text.replace(HIDDEN_CHARACTER_REGEX, character =>
    Array.from({ length: character.length }, (_, index) => `\\u${character.charCodeAt(index).toString(16).padStart(4, '0')}`).join('')
  )

const DEFAULT_UNTRUSTED_LABEL_LENGTH = 40

/**
 * A label a third party wrote (a token name or symbol, a place title, an NFT name), made safe to show
 * inside a screen the page vouches for: trimmed, its hidden characters revealed so none can reorder or
 * hide the text around it, and cut to `maxLength` with an ellipsis so it cannot push the facts, the
 * fee or the acknowledgment out of view. Empty for anything that is not a string.
 */
const formatUntrustedLabel = (value: unknown, maxLength = DEFAULT_UNTRUSTED_LABEL_LENGTH): string => {
  if (typeof value !== 'string') return ''
  const revealed = revealHiddenCharacters(value.trim())
  return revealed.length > maxLength ? `${revealed.slice(0, maxLength - 1)}…` : revealed
}

export { HIDDEN_CHARACTER_PATTERN, capitalize, formatUntrustedLabel, revealHiddenCharacters, shortenAddress }
