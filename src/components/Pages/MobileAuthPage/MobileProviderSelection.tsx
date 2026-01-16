import { ConnectionOptionType, Connection, ConnectionProps } from '../../Connection'
import styles from './MobileAuthPage.module.css'

type Props = {
  onConnect: (type: ConnectionOptionType) => void
  loadingOption?: ConnectionOptionType
  connectionOptions: NonNullable<ConnectionProps['connectionOptions']>
}

export const MobileProviderSelection = ({ onConnect, loadingOption, connectionOptions }: Props) => {
  return (
    <main className={styles.main}>
      <div className={styles.background} />
      <div className={styles.content}>
        <Connection onConnect={onConnect} loadingOption={loadingOption} connectionOptions={connectionOptions} />
      </div>
    </main>
  )
}
