import React from 'react'
import { isErrorWithMessage } from '../../shared/errors'
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

  constructor(props: Props) {
    super(props)
    this.widget = IntercomWidget.getInstance()

    if (!this.widget.appId) {
      this.widget.init(props.appId, props.settings)
    } else {
      if (this.widget.appId !== props.appId) {
        throw new Error(`Intercom widget already initialized with app id "${props.appId}". Only one intercom widget is allowed.`)
      }

      // Else, all settings will be ignored but no notice will be given
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

    try {
      await this.widget.inject()
      this.widget.render(data)
    } catch (error) {
      console.error('Could not render intercom', isErrorWithMessage(error) ? error.message : 'Unknown error')
    }
  }

  render() {
    return null
  }
}
