import classNames from 'classnames'
import Popup from 'semantic-ui-react/dist/commonjs/modules/Popup'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { capitalize } from '../../../shared/text'
import { ConnectionIconProps } from './ConnectionOption.types'
import styles from './ConnectionOption.module.css'

export const ConnectionOption = (props: ConnectionIconProps): JSX.Element => {
  const { className, children, type, testId, showTooltip, tooltipPosition, disabled, loading, onClick } = props
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
          className={classNames(className, styles.button)}
          onClick={() => onClick(type)}
          disabled={disabled}
          loading={loading}
        >
          {!loading ? (
            <div role="img" aria-label={type} className={classNames(styles.icon, styles[`icon-${type}`], styles.primaryImage)} />
          ) : null}
          {children}
        </Button>
      }
      content={capitalize(type)}
      on="hover"
    />
  )
}
