// import { isElectron } from '../../../integration/desktop'
import { useCallback } from 'react'
import { Connection } from '../../Connection'
import styles from './LoginPage.module.css'

export const LoginPage = () => {
  const handleOnConnect = useCallback(provider => {
    alert('Connect to ' + provider)
  }, [])

  const handleOnLearMore = useCallback(() => {
    alert('On learn more')
  }, [])

  return (
    <main className={styles.main}>
      <div className={styles.left}>
        <Connection className={styles.connection} onConnect={handleOnConnect} onLearnMore={handleOnLearMore} />
      </div>
      <div className={styles.right}>
        {/* {!isElectron() ? ( */}
        <div className={styles.footer}>
          <p>Want better graphics and faster speed?</p>

          <span>
            👉&nbsp;&nbsp;
            <a href="https://decentraland.org/download/" target="_blank" rel="noreferrer">
              <b>Download desktop client</b>
            </a>
          </span>
        </div>
        {/* ) : null} */}
      </div>
    </main>
  )
}
