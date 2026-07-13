import { IntercomSettings, IntercomWindow } from './Intercom.types'

const intercomWindow = window as unknown as IntercomWindow

// How long to wait for the Intercom widget script before giving up, so a blocked
// or offline script surfaces an error to the caller instead of hanging forever.
const INJECT_TIMEOUT_MS = 10000

class IntercomWidget {
  private _appId: string | undefined
  private _settings: IntercomSettings | undefined
  private _injectPromise: Promise<void> | undefined
  client: ((method: string, arg?: unknown) => void) | undefined

  static instance: IntercomWidget

  static getInstance(): IntercomWidget {
    if (!this.instance) {
      this.instance = new IntercomWidget()
    }
    return this.instance
  }

  set appId(id: string | undefined) {
    this._appId = id
    this.client = getWindowClient(id)
  }

  get appId(): string | undefined {
    return this._appId
  }

  set settings(settings: IntercomSettings | undefined) {
    this._settings = settings
    if (settings !== undefined) {
      intercomWindow.intercomSettings = settings
    }
  }

  get settings(): IntercomSettings | undefined {
    return this._settings
  }

  init(appId: string, settings?: IntercomSettings) {
    this.appId = appId

    if (settings) {
      this.settings = settings
    }
  }

  inject() {
    if (this.isInjected()) {
      return Promise.resolve()
    }

    // Reuse an in-flight injection. isInjected() only becomes true once the script loads and
    // bootstraps window.Intercom, so without this guard a second inject() before that (e.g. a
    // componentDidUpdate during the load window) would append a duplicate widget <script>.
    if (this._injectPromise) {
      return this._injectPromise
    }

    this._injectPromise = new Promise<void>((resolve, reject) => {
      const script = insertScript({
        src: `https://widget.intercom.io/widget/${this._appId}`
      })

      // Ensure the promise always settles so a blocked/offline script rejects
      // (surfacing to the caller's catch) instead of hanging forever.
      const timeoutId = setTimeout(() => reject(new Error('Timed out loading the Intercom widget script')), INJECT_TIMEOUT_MS)

      script.addEventListener(
        'load',
        () => {
          clearTimeout(timeoutId)
          resolve()
        },
        true
      )
      script.addEventListener(
        'error',
        () => {
          clearTimeout(timeoutId)
          reject(new Error('Failed to load the Intercom widget script'))
        },
        true
      )
    })
      .then(() => {
        this.client = getWindowClient(this._appId)
      })
      .catch(error => {
        // Clear the cached promise so a later inject() can retry after a transient failure/timeout.
        this._injectPromise = undefined
        throw error
      })

    return this._injectPromise
  }

  render(data: Record<string, unknown> = {}) {
    this.client?.('reattach_activator')
    // eslint-disable-next-line @typescript-eslint/naming-convention
    this.client?.('update', { ...data, app_id: this._appId })
  }

  showNewMessage(text: string) {
    this.client?.('showNewMessage', text)
  }

  unmount() {
    this.client?.('shutdown')
  }

  isInjected() {
    return isInjected()
  }
}

function getWindowClient(appId: string | undefined) {
  return (...args: [string, ...unknown[]]) => {
    if (!appId) {
      return console.warn('Intercom app id empty. Check that the environment is property set')
    }

    if (isMobile()) {
      return
    }

    if (!isInjected()) {
      return console.warn('Intercom called before injection')
    }

    intercomWindow.Intercom?.(...args)
  }
}

function isInjected() {
  return typeof intercomWindow.Intercom === 'function'
}

function isMobile() {
  // WARN: Super naive mobile device check.
  // we're using it on low-stake checks, where failing to detect some browsers is not a big deal.
  // If you need more specificity you may want to change this implementation.
  const navigator = window.navigator

  return !!navigator && (/Mobi/i.test(navigator.userAgent) || /Android/i.test(navigator.userAgent))
}

function insertScript({ type = 'text/javascript', async = true, ...props }) {
  const script = document.createElement('script')
  Object.assign(script, { type, async: async, ...props }) // WARN: babel breaks on `{ async }`

  document.body.appendChild(script)

  return script
}

export { IntercomWidget }
