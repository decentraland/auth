import classNames from 'classnames'
import { capitalize } from '../../../shared/text'
import { ConnectionIconProps } from './ConnectionOption.types'
import styles from './ConnectionOption.module.css'

export const ConnectionOption = (props: ConnectionIconProps): JSX.Element => {
  const { className, children, type, testId, showTooltip, disabled, info, loading, onClick } = props
  const title = showTooltip ? info ?? capitalize(type) : undefined

  return (
    <button
      type="button"
      data-testid={`${testId}-${type}-button`}
      // Rationale: use the native `title` tooltip to avoid third-party tooltip implementations that rely on `findDOMNode`.
      title={title}
      className={classNames('ui', 'small', 'primary', 'button', className, styles.button, {
        disabled,
        loading
      })}
      onClick={() => onClick(type)}
      disabled={disabled}
    >
      {!loading ? (
        <div role="img" aria-label={type} className={classNames(styles.icon, styles[`icon-${type}`], styles.primaryImage)} />
      ) : null}
      {children}
    </button>
  )
}
