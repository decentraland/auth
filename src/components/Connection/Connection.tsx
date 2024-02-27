import React, { useCallback, useState } from 'react'
import classNames from 'classnames'
import Icon from 'semantic-ui-react/dist/commonjs/elements/Icon/Icon'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import logoSrc from '../../assets/images/logo.svg'
import { ConnectionOption } from './ConnectionOption'
import {
  SHOW_MORE_BUTTON_TEST_ID,
  SOCIAL_PRIMARY_TEST_ID,
  SOCIAL_SECONDARY_TEST_ID,
  WEB3_PRIMARY_TEST_ID,
  WEB3_SECONDARY_TEST_ID
} from './constants'
import { ConnectionOptionType, ConnectionProps, MetamaskEthereumWindow } from './Connection.types'
import styles from './Connection.module.css'

const Primary = ({
  message,
  children,
  option,
  testId,
  loadingOption,
  error,
  onConnect
}: {
  message: React.ReactNode
  children: React.ReactChild
  option: ConnectionOptionType
  loadingOption?: ConnectionOptionType
  error?: string
  testId?: string
  onConnect: (wallet: ConnectionOptionType) => unknown
}) => (
  <div className={styles.primary} data-testid={testId}>
    <div className={styles.primaryMessage}>{message}</div>
    <ConnectionOption
      disabled={!!loadingOption || !!error}
      loading={loadingOption === option}
      showTooltip={!!error}
      type={option}
      info={error}
      onClick={onConnect}
      className={classNames(styles.primaryButton, styles.primaryOption)}
      testId={testId}
    >
      {children}
    </ConnectionOption>
  </div>
)

const Secondary = ({
  options,
  tooltipDirection,
  testId,
  loadingOption,
  onConnect
}: {
  options: ConnectionOptionType[]
  tooltipDirection: 'top center' | 'bottom center'
  testId?: string
  loadingOption?: ConnectionOptionType
  onConnect: (wallet: ConnectionOptionType) => unknown
}) => (
  <div className={styles.showMoreSecondaryOptions} data-testid={testId}>
    {options.map(option => (
      <ConnectionOption
        key={option}
        className={classNames(styles.primaryButton, styles.secondaryOptionButton)}
        showTooltip
        tooltipPosition={tooltipDirection}
        type={option}
        onClick={onConnect}
        testId={testId}
        loading={loadingOption === option}
        disabled={!!loadingOption}
      />
    ))}
  </div>
)

const defaultProps = {
  i18n: {
    title: 'Discover a virtual social world',
    subtitle: 'shaped by its community of creators & explorers.',
    accessWith: (option: React.ReactNode) => `Continue with ${option}`,
    connectWith: (option: React.ReactNode) => `Continue with ${option}`,
    moreOptions: 'More Options',
    socialMessage: (element: React.ReactNode) => <>Access secured by {element}</>,
    web3Message: (learnMore: (value: React.ReactNode) => React.ReactNode) => <>Have a digital wallet? {learnMore('Learn More')}</>
  }
}

export const Connection = (props: ConnectionProps): JSX.Element => {
  const { i18n = defaultProps.i18n, onConnect, onLearnMore, socialOptions, web3Options, className, loadingOption } = props

  const [showMore, setShowMore] = useState(false)
  const handleShowMore = useCallback(() => {
    setShowMore(!showMore)
  }, [showMore])

  const isMetamaskAvailable = (window.ethereum as MetamaskEthereumWindow)?.isMetaMask
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
            loadingOption={loadingOption}
            message={
              <>
                {i18n.socialMessage(<div className={styles.primaryMagic} role="img" aria-label="Magic" />)}
                <span className={styles.primaryLearnMore} role="button" onClick={() => onLearnMore(socialOptions?.primary)}>
                  Learn More
                </span>
              </>
            }
          >
            <>{i18n.accessWith(socialOptions?.primary)}</>
          </Primary>
        ) : null}
        {web3Options ? (
          <Primary
            onConnect={onConnect}
            testId={WEB3_PRIMARY_TEST_ID}
            option={web3Options?.primary}
            loadingOption={loadingOption}
            error={
              !isMetamaskAvailable && web3Options?.primary === ConnectionOptionType.METAMASK
                ? 'You need to install the MetaMask Browser Extension to proceed. Please install it and try again.'
                : undefined
            }
            message={i18n.web3Message(element => (
              <span className={styles.primaryLearnMore} role="button" onClick={() => onLearnMore(web3Options.primary)}>
                {element}
              </span>
            ))}
          >
            <>{i18n.connectWith(web3Options?.primary)}</>
          </Primary>
        ) : null}
      </div>

      <div className={styles.showMore}>
        {(hasWeb3SecondaryOptions || hasSocialSecondaryOptions) && (
          <Button
            data-testid={SHOW_MORE_BUTTON_TEST_ID}
            basic
            size="medium"
            fluid
            className={styles.showMoreButton}
            onClick={handleShowMore}
          >
            {i18n.moreOptions}
            <Icon name={showMore ? 'chevron up' : 'chevron down'} />
          </Button>
        )}
        {showMore && hasSocialSecondaryOptions && (
          <Secondary
            testId={SOCIAL_SECONDARY_TEST_ID}
            options={socialOptions.secondary}
            onConnect={onConnect}
            tooltipDirection="top center"
            loadingOption={loadingOption}
          />
        )}
        {showMore && hasWeb3SecondaryOptions && (
          <Secondary
            testId={WEB3_SECONDARY_TEST_ID}
            options={web3Options.secondary}
            onConnect={onConnect}
            tooltipDirection="bottom center"
            loadingOption={loadingOption}
          />
        )}
      </div>
    </div>
  )
}
