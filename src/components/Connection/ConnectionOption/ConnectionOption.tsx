import Tooltip from '@mui/material/Tooltip'
import classNames from 'classnames'
import { Button, CircularProgress } from 'decentraland-ui2'
import { capitalize } from '../../../shared/text'
import { ConnectionIconProps } from './ConnectionOption.types'
import styles from './ConnectionOption.module.css'

export const ConnectionOption = (props: ConnectionIconProps): JSX.Element => {
  const { className, children, type, testId, showTooltip, tooltipPosition, disabled, info, loading, onClick } = props

  const button = (
    <Button
      variant="contained"
      key={type}
      size="small"
      data-testid={`${testId}-${type}-button`}
      className={classNames(className, styles.button)}
      onClick={() => onClick(type)}
      disabled={disabled || loading}
    >
      {loading ? (
        <CircularProgress size={20} color="inherit" />
      ) : (
        <div role="img" aria-label={type} className={classNames(styles.icon, styles[`icon-${type}`], styles.primaryImage)} />
      )}
      {children}
    </Button>
  )

  if (!showTooltip) {
    return button
  }

  return (
    <Tooltip title={info ?? capitalize(type)} placement={tooltipPosition ?? 'top'}>
      <span>{button}</span>
    </Tooltip>
  )
}
