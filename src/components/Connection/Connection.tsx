import React, { useCallback, useState } from 'react'
import classNames from 'classnames'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import logoSrc from '../../assets/images/logo.svg'
import { ConnectionIcon } from './ConnectionIcon'
import {
  SHOW_MORE_BUTTON_TEST_ID,
  SOCIAL_PRIMARY_TEST_ID,
  SOCIAL_SECONDARY_TEST_ID,
  WEB3_PRIMARY_TEST_ID,
  WEB3_SECONDARY_TEST_ID
} from './constants'
import { ConnectionOptionType, ConnectionProps } from './Connection.types'
import styles from './Connection.module.css'

const Primary = ({
  message,
  children,
  option,
  testId,
  onConnect
}: {
  message: React.ReactNode
  children: React.ReactChild
  option: ConnectionOptionType
  testId?: string
  onConnect: (wallet: ConnectionOptionType) => unknown
}) => (
  <div className={styles.primary} data-testid={testId}>
    <div className={styles.primaryMessage}>{message}</div>
    <Button
      primary
      size="small"
      fluid
      data-testid={`${testId}-button`}
      className={classNames(styles.primaryButton, styles.primaryOption)}
      onClick={() => onConnect(option)}
    >
      <ConnectionIcon className={styles.primaryImage} type={option} />
      {children}
    </Button>
  </div>
)

const Secondary = ({
  options,
  tooltipDirection,
  testId,
  onConnect
}: {
  options: ConnectionOptionType[]
  tooltipDirection: 'top center' | 'bottom center'
  testId?: string
  onConnect: (wallet: ConnectionOptionType) => unknown
}) => (
  <div className={styles.showMoreSecondaryOptions} data-testid={testId}>
    {options.map(option => (
      <Button
        primary
        key={option}
        size="small"
        data-testid={`${testId}-${option}-button`}
        className={classNames(styles.primaryButton, styles.secondaryOptionButton)}
        onClick={() => onConnect(option)}
      >
        <ConnectionIcon className="dui-connection-primary__image" showTooltip tooltipPosition={tooltipDirection} type={option} />
      </Button>
    ))}
  </div>
)

const defaultProps = {
  i18n: {
    title: 'Unlock Your Virtual World.',
    subtitle: 'Access and start exploring.',
    accessWith: (option: React.ReactNode) => `Access with ${option}`,
    connectWith: (option: React.ReactNode) => `Connect with ${option}`,
    moreOptions: 'More Options',
    socialMessage: (element: React.ReactNode) => <>Access secured by {element}</>,
    web3Message: (learnMore: (value: React.ReactNode) => React.ReactNode) => <>Curious about wallets? {learnMore('Learn More')}</>
  }
}

export const Connection = (props: ConnectionProps): JSX.Element => {
  const { i18n = defaultProps.i18n, onConnect, onLearnMore, socialOptions, web3Options, className } = props

  const [showMore, setShowMore] = useState(false)
  const handleShowMore = useCallback(() => {
    setShowMore(true)
  }, [])

  const hasSocialSecondaryOptions = socialOptions && socialOptions.secondary && socialOptions.secondary.length > 0
  const hasWeb3SecondaryOptions = web3Options && web3Options.secondary && web3Options.secondary.length > 0

  return (
    <div className={classNames(className, styles.connection)}>
      <img className={styles.dclLogo} src={logoSrc} alt="Decentraland logo" />
      <div>
        <h1 className={styles.title}>{i18n.title}</h1>
        <h2 className={styles.subtitle}>{i18n.subtitle}</h2>
        {socialOptions ? (
          <Primary
            onConnect={onConnect}
            testId={SOCIAL_PRIMARY_TEST_ID}
            option={socialOptions?.primary}
            message={<>{i18n.socialMessage(<div className={styles.primaryMagic} role="img" aria-label="Magic" />)}</>}
          >
            <>{i18n.accessWith(socialOptions?.primary)}</>
          </Primary>
        ) : null}
        {web3Options ? (
          <Primary
            onConnect={onConnect}
            testId={WEB3_PRIMARY_TEST_ID}
            option={web3Options?.primary}
            message={i18n.web3Message(element => (
              <span className={styles.primaryLearnMore} role="button" onClick={onLearnMore}>
                {element}
              </span>
            ))}
          >
            <>{i18n.connectWith(web3Options?.primary)}</>
          </Primary>
        ) : null}
      </div>

      <div className={styles.showMore}>
        {!showMore && (hasWeb3SecondaryOptions || hasSocialSecondaryOptions) ? (
          <Button
            data-testid={SHOW_MORE_BUTTON_TEST_ID}
            inverted
            secondary
            size="medium"
            fluid
            className={styles.showMoreButton}
            onClick={handleShowMore}
          >
            {i18n.moreOptions}
          </Button>
        ) : (
          <>
            {hasSocialSecondaryOptions ? (
              <Secondary
                testId={SOCIAL_SECONDARY_TEST_ID}
                options={socialOptions.secondary}
                onConnect={onConnect}
                tooltipDirection="top center"
              />
            ) : null}
            {hasWeb3SecondaryOptions ? (
              <Secondary
                testId={WEB3_SECONDARY_TEST_ID}
                options={web3Options.secondary}
                onConnect={onConnect}
                tooltipDirection="bottom center"
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
