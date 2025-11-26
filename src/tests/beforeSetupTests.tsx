// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import path from 'path'
import { TextEncoder, TextDecoder } from 'util'
import { config } from 'dotenv'

config({ path: path.resolve(process.cwd(), '.env.example') })
// eslint-disable-next-line @typescript-eslint/naming-convention
Object.assign(globalThis, { TextDecoder, TextEncoder })

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => {
    const mediaQueryList = {
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    }
    return mediaQueryList
  }
})

// Mock HTMLCanvasElement.prototype.getContext for jsdom
HTMLCanvasElement.prototype.getContext = jest.fn(() => {
  return {
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(() => ({
      data: new Uint8ClampedArray()
    })),
    putImageData: jest.fn(),
    createImageData: jest.fn(),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    fillText: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    transform: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn()
  } as any
})

// Mock HTMLCanvasElement.prototype.toDataURL
HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mock')
