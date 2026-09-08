import { revealHiddenCharacters } from '../../../../shared/text'

/**
 * Typed data as the wallet reads it, for display: parsed and pretty-printed, so the screen shows the
 * structure the wallet hashes (a key given twice shows once, with the value the wallet keeps), with
 * every hidden character revealed as its escape so none can lay out the text around it (a right-to-left
 * override inside a value would otherwise mirror the rest of the line). Text that is not JSON is shown as
 * sent; the wallet refuses it. Display only: the bytes forwarded to the wallet are the classification's.
 */
function formatTypedDataForDisplay(raw: string): string {
  let text = raw
  try {
    text = JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    // Not JSON.
  }
  return revealHiddenCharacters(text)
}

export { formatTypedDataForDisplay }
