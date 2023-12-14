import classNames from 'classnames'
import Popup from 'semantic-ui-react/dist/commonjs/modules/Popup'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { ConnectionIconProps } from './ConnectionOption.types'
import styles from './ConnectionOption.module.css'

export const ConnectionOption = (props: ConnectionIconProps): JSX.Element => {
  const { className, children, type, testId, showTooltip, tooltipPosition, onClick } = props
  return (
    <Popup
      position={showTooltip && tooltipPosition ? tooltipPosition : 'top center'}
      disabled={!showTooltip}
      trigger={
        <Button
          primary
          key={type}
          size="small"
          data-testid={`${testId}-${type}-button`}
          className={className}
          onClick={() => onClick(type)}
        >
          <div role="img" aria-label={type} className={classNames(styles.icon, styles[`icon-${type}`], styles.primaryImage)} />
          {children}
        </Button>
      }
      content={type}
      on="hover"
    />
  )
}
