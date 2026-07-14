/**
 * image.js — small client-side image helpers.
 * ----------------------------------------------------------------------------
 * resizeImageToDataUrl downscales + centre-crops an uploaded image to a square
 * data URL so custom subject icons stay tiny (a few KB) and can be stored inline
 * in the `subjects.icon` column without a storage bucket.
 */

/**
 * @param {File}   file        the user-selected image file
 * @param {number} [size=128]  output square edge in px
 * @returns {Promise<string>}  a PNG data URL, cover-cropped to size×size
 */
export function resizeImageToDataUrl(file, size = 128) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Not an image file'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not decode the image'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        // Cover-crop: scale so the shorter side fills, centre the overflow.
        const scale = Math.max(size / img.width, size / img.height)
        const w = img.width * scale
        const h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
