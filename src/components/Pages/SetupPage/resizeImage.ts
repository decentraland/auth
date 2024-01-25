/**
 * Resizes an image to 256x256.
 * This function is on a different file than utils because it uses the browser API which is currently not supported by the tests.
 * TODO: Move this function back to utils and test it.
 */
export async function resizeImage(buffer: Buffer): Promise<Buffer> {
  const width = 256
  const height = 256

  return new Promise((resolve, reject) => {
    // Convert Buffer to Blob
    const blob = new Blob([buffer], { type: 'image/png' })

    // Create an Image element
    const img = new Image()

    img.onload = () => {
      // Create a Canvas element and set its size
      const canvas = document.createElement('canvas')

      canvas.width = width
      canvas.height = height

      // Draw the image onto the canvas
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        return reject(new Error('Failed to get canvas context'))
      }

      ctx.drawImage(img, 0, 0, width, height)

      // Convert the canvas back to a Blob, then to a Buffer
      canvas.toBlob(blob => {
        if (!blob) {
          return reject(new Error('Failed to convert canvas to blob'))
        }

        const reader = new FileReader()

        reader.onload = () => resolve(Buffer.from(reader.result as ArrayBuffer))
        reader.onerror = () => reject(new Error('Failed to read blob as buffer'))
        reader.readAsArrayBuffer(blob)
      }, 'image/png')
    }

    img.onerror = () => reject(new Error('Failed to load image'))

    // Create an Object URL from the Blob and set it as the image source
    img.src = URL.createObjectURL(blob)
  })
}
