import { Buffer } from 'buffer'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process?: any
  }
}

// Some toolchains inject a partial `process` stub (only `env`) in the browser.
// `readable-stream` expects `process.browser` + `process.version` to exist.
// We patch the global object early to avoid runtime crashes inside node shims.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalAny = globalThis as any

if (globalAny.process) {
  globalAny.process.browser = true
  if (typeof globalAny.process.version !== 'string') {
    globalAny.process.version = ''
  }
  if (!globalAny.process.env) {
    globalAny.process.env = {}
  }
}

if (!globalAny.Buffer) {
  globalAny.Buffer = Buffer
}

if (!globalAny.global) {
  globalAny.global = globalAny
}

// Prevent "Maximum call stack size exceeded" when browser translation extensions
// (e.g. Google Translate) modify DOM nodes managed by React.
// Translation extensions wrap text nodes in <font> elements. When React reconciles,
// it tries to remove those elements, the extension's MutationObserver re-inserts them
// synchronously, and React removes them again — causing infinite recursion.
// This patch breaks the cycle by gracefully handling parent-child mismatches.
// See: https://github.com/facebook/react/issues/11538
if (typeof Node === 'function' && Node.prototype) {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- stored to delegate via .call() with correct `this`
  const originalRemoveChild = Node.prototype.removeChild

  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      return child
    }
    return originalRemoveChild.call(this, child) as T
  }

  // eslint-disable-next-line @typescript-eslint/unbound-method -- stored to delegate via .call() with correct `this`
  const originalInsertBefore = Node.prototype.insertBefore

  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return newNode
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T
  }
}
