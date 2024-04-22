import { Link } from 'react-router-dom'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Modal } from 'decentraland-ui/dist/components/Modal/Modal'
import { ModalNavigation } from 'decentraland-ui/dist/components/ModalNavigation/ModalNavigation'
import warningSrc from '../../../assets/images/warning.svg'
import { locations } from '../../../shared/locations'
import style from './InvalidRedirectionPage.module.css'

export const InvalidRedirectionPage = () => {
  return (
    <Modal size="tiny" open={true}>
      <ModalNavigation title="Invalid redirection" onClose={undefined} />
      <Modal.Content className={style.content}>
        <img className={style.warningImage} src={warningSrc} />
        <p>The site you were redirected to is invalid.</p>
      </Modal.Content>
      <Modal.Actions>
        <Button primary as={Link} to={locations.login()}>
          Go back to the login page
        </Button>
      </Modal.Actions>
    </Modal>
  )
}
