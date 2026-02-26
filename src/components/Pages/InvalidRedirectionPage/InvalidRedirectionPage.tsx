import { Link } from 'react-router-dom'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from 'decentraland-ui2'
import warningSrc from '../../../assets/images/warning.svg'
import { locations } from '../../../shared/locations'
import style from './InvalidRedirectionPage.module.css'

export const InvalidRedirectionPage = () => {
  return (
    <Dialog open={true} maxWidth="xs" fullWidth>
      <DialogTitle>Invalid redirection</DialogTitle>
      <DialogContent className={style.content}>
        <img className={style.warningImage} src={warningSrc} />
        <p>The site you were redirected to is invalid.</p>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" component={Link} to={locations.login()}>
          Go back to the login page
        </Button>
      </DialogActions>
    </Dialog>
  )
}
