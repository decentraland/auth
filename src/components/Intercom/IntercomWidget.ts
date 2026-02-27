import { IntercomSettings, IntercomWindow } from './Intercom.types'

const intercomWindow = window as unknown as IntercomWindow

class IntercomWidget {
  private _appId: string | undefined
  private _settings: IntercomSettings | undefined
  client: ((method: string, arg?: unknown) => void) | undefined

  static instance: IntercomWidget

  static getInstance(): IntercomWidget {
    if (!this.instance) {
      this.instance = new IntercomWidget()
    }
    return this.instance
  }

  set appId(id: string) {
    this._appId = id
    this.client = getWindowClient(id)
  }

  get appId(): string | undefined {
    return this._appId
  }

  set settings(settings: IntercomSettings) {
    this._settings = settings
    intercomWindow.intercomSettings = settings
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
    return new Promise<void>(resolve => {
      if (this.isInjected()) {
        return resolve()
      }

      const script = insertScript({
        src: `https://widget.intercom.io/widget/${this._appId}`
      })
      script.addEventListener('load', () => resolve(), true)
    }).then(() => {
      this.client = getWindowClient(this._appId)
    })
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
