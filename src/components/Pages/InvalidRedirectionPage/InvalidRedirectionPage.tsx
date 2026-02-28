import { Link } from 'react-router-dom'
import { useTranslation } from '@dcl/hooks'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from 'decentraland-ui2'
import warningSrc from '../../../assets/images/warning.svg'
import { locations } from '../../../shared/locations'
import style from './InvalidRedirectionPage.module.css'

export const InvalidRedirectionPage = () => {
  const { t } = useTranslation()
  return (
    <Dialog open={true} maxWidth="xs" fullWidth>
      <DialogTitle>{t('invalid_redirection.title')}</DialogTitle>
      <DialogContent className={style.content}>
        <img className={style.warningImage} src={warningSrc} />
        <p>{t('invalid_redirection.description')}</p>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" component={Link} to={locations.login()}>
          {t('invalid_redirection.go_back')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
