import { useTranslation } from '@dcl/hooks'
import styles from './Views.module.css'

export const CloseWindow = () => {
  const { t } = useTranslation()
  return <div className={styles.closeWindow}>{t('common.close_window')}</div>
}
