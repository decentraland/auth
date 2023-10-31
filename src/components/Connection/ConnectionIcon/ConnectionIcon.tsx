import React from 'react'
import classNames from 'classnames'
import Popup from 'semantic-ui-react/dist/commonjs/modules/Popup'
import { ConnectionIconProps } from './ConnectionIcon.types'
import styles from './ConnectionIcon.module.css'

export const ConnectionIcon = (props: ConnectionIconProps): JSX.Element => {
  const { className, type, showTooltip, tooltipPosition } = props
  return (
    <Popup
      position={showTooltip && tooltipPosition ? tooltipPosition : 'top center'}
      disabled={!showTooltip}
      trigger={<div role="img" aria-label={type} className={classNames(styles.icon, styles[`icon-${type}`], className)} />}
      content={type}
      on="hover"
    />
  )
}
