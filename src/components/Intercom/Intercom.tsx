import * as React from 'react'
import { handleError } from '../../shared/utils/errorHandler'
import { IntercomWidget } from './IntercomWidget'
import { DefaultProps, Props } from './Intercom.types'

export default class Intercom extends React.PureComponent<Props> {
  static defaultProps: DefaultProps = {
    data: {},
    settings: {
      alignment: 'left',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      horizontal_padding: 10,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      vertical_padding: 10
    }
  }

  private readonly widget: IntercomWidget
  private readonly enabled: boolean

  constructor(props: Props) {
    super(props)
    this.widget = IntercomWidget.getInstance()
    const appId = String(props.appId ?? '').trim()
    // Rationale: in local/dev environments this can be empty or the literal string "undefined"/"null".
    // Intercom will spam console warnings and failed network requests if we attempt to boot without a valid App ID.
    this.enabled = Boolean(appId) && appId !== 'undefined' && appId !== 'null'

    if (!this.enabled) {
      return
    }

    if (!this.widget.appId) {
      this.widget.init(props.appId, props.settings)
      return
    }

    if (this.widget.appId !== props.appId) {
      throw new Error(`Intercom widget already initialized with app id "${props.appId}". Only one intercom widget is allowed.`)
    }
  }

  componentDidMount() {
    this.renderWidget()
  }

  componentDidUpdate() {
    if (this.props.settings) {
      this.widget.settings = this.props.settings
    }
    this.renderWidget()
  }

  componentWillUnmount() {
    this.widget.unmount()
  }

  async renderWidget() {
    const { data } = this.props

    if (!this.enabled) {
      return
    }

    try {
      await this.widget.inject()
      this.widget.render(data)
    } catch (error) {
      handleError(error, 'Could not render intercom', { skipTracking: true })
    }
  }

  render() {
    return null
  }
}
