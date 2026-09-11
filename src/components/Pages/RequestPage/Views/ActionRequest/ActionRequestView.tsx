import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatEther } from 'viem'
import { useTranslation } from '@dcl/hooks'
import { Box, Button, Checkbox, CircularProgress, FormControlLabel } from 'decentraland-ui2'
import { getNativeSymbol } from '../../../../../shared/explorer'
import { Container } from '../../Container'
import { ButtonsContainer, ReviewRestartedNotice } from '../../RequestPage.styled'
import { formatTypedDataForDisplay } from '../typedDataDisplay'
import styles from '../Views.module.css'
import { ActionRequestPayload, ActionRequestViewProps } from './ActionRequest.types'
import {
  ConsentBox,
  Content,
  Hint,
  PayloadBlock,
  PayloadFrame,
  PayloadLabel,
  Statement,
  WarningBox,
  WarningTitle
} from './ActionRequest.styled'

type Translate = (key: string, opts?: Record<string, string | number>) => string

// How far from the bottom, in pixels, still counts as the end: scroll positions are fractional on zoomed and
// high-density screens, and a reader who stopped a pixel short has read everything there is.
const SCROLL_END_TOLERANCE = 2

/**
 * What a malicious request of this kind could do, as the keys of the lines the warning box lists above the
 * consent. A
 * transaction runs from the account and is final; a signature is a bearer authorization that never expires;
 * a plain message can be a login or an off-chain order. Every kind ends on the same line: trust the asker.
 */
function getWarningKeys(payload: ActionRequestPayload): string[] {
  switch (payload.kind) {
    case 'transaction':
      return [
        'request.action.warning_transaction_assets',
        'request.action.warning_transaction_permissions',
        'request.action.warning_transaction_final',
        'request.action.warning_trust'
      ]
    case 'typed_data':
      return [
        'request.action.warning_signature_orders',
        'request.action.warning_signature_bearer',
        'request.action.warning_signature_login',
        'request.action.warning_trust'
      ]
    case 'message':
      return ['request.action.warning_signature_login', 'request.action.warning_signature_orders', 'request.action.warning_trust']
  }
}

/**
 * The payload as one block of text, whole. A transaction is its fields, one per line, with the value also
 * read as an amount of the chain's currency; typed data is its JSON, pretty-printed and with hidden
 * characters revealed; a message is its text, or its bytes when it is not readable text.
 */
function formatPayload(payload: ActionRequestPayload, t: Translate): string {
  switch (payload.kind) {
    case 'transaction': {
      const symbol = getNativeSymbol(payload.chainId) || t('request.transaction_dialog.native_currency')
      const amount = `${formatEther(BigInt(payload.value))} ${symbol}`
      return [
        `${t('request.action.payload_to')}: ${payload.to}`,
        `${t('request.action.payload_value')}: ${payload.value} (${amount})`,
        `${t('request.action.payload_data')}: ${payload.data}`,
        `${t('request.action.payload_chain')}: ${payload.chainId}`
      ].join('\n')
    }
    case 'typed_data':
      return formatTypedDataForDisplay(payload.raw)
    case 'message':
      return payload.text ?? payload.hex
  }
}

/**
 * The review of any request that is not a tip or a gift, whatever it targets: a title and one sentence saying
 * that an action with the wallet was asked for, everything the wallet will be handed, what a malicious
 * request could do, and one checkbox by which the user takes responsibility for it. Nothing is interpreted or
 * vouched for.
 *
 * The payload sits in a box of fixed height, and the checkbox and Allow stay disabled until that box has
 * been scrolled to its end, so an authorization buried below a benign opening cannot be agreed to unseen.
 * This is the one gate the page leaves to a view, because only the view can measure it; whether the tick
 * then counts is still the page's to decide (see isReviewActionable in RequestPage).
 */
export const ActionRequestView = ({
  requestId,
  payload,
  approveBlocked = true,
  acknowledged = false,
  isLoading = false,
  reviewRestarted = false,
  onAcknowledgedChange,
  onDeny,
  onApprove
}: ActionRequestViewProps) => {
  const { t } = useTranslation()
  // Formatting is linear in the payload's size; done once per payload, not per render.
  const content = useMemo(() => formatPayload(payload, t), [payload, t])

  // Measured before paint and on every scroll, so the checkbox is never enabled for a frame the measurement
  // has not seen; a payload that fits the box without scrolling counts as read. Re-measured when the window
  // changes size (a phone turning sideways changes how much of the box shows) and when the payload changes,
  // which also puts the box back at the top: a new payload starts unread.
  const payloadRef = useRef<HTMLDivElement>(null)
  const [readToEnd, setReadToEnd] = useState(false)
  const measure = useCallback(() => {
    const element = payloadRef.current
    if (!element) return
    setReadToEnd(element.scrollHeight - element.scrollTop - element.clientHeight <= SCROLL_END_TOLERANCE)
  }, [])
  useLayoutEffect(() => {
    const element = payloadRef.current
    if (element) element.scrollTop = 0
    measure()
  }, [measure, content])
  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  return (
    <Container canChangeAccount requestId={requestId}>
      <Box className={styles.logo}></Box>
      <Box className={styles.title} data-testid="action-title">
        {t('request.action.title')}
      </Box>
      <Statement data-testid="action-statement">{t('request.action.statement')}</Statement>
      <Content data-testid="action-request" data-kind={payload.kind}>
        <PayloadLabel id="action-payload-label">{t('request.action.payload_label')}</PayloadLabel>
        <PayloadFrame more={!readToEnd}>
          <PayloadBlock
            ref={payloadRef}
            onScroll={measure}
            role="region"
            aria-labelledby="action-payload-label"
            tabIndex={0}
            data-testid="action-payload"
          >
            {content}
          </PayloadBlock>
        </PayloadFrame>
        {readToEnd ? null : <Hint data-testid="action-scroll-hint">{t('request.action.scroll_hint')}</Hint>}
        {reviewRestarted ? (
          <ReviewRestartedNotice severity="info" role="status" data-testid="review-restarted-notice">
            {t('request.action.review_restarted_notice')}
          </ReviewRestartedNotice>
        ) : null}
        <WarningBox severity="warning" role="alert" data-testid="action-warnings">
          <WarningTitle>{t('request.action.warning_title')}</WarningTitle>
          <ul>
            {getWarningKeys(payload).map(key => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </WarningBox>
        <ConsentBox data-testid="action-consent">
          <FormControlLabel
            control={
              <Checkbox
                checked={acknowledged}
                disabled={!readToEnd}
                onChange={event => onAcknowledgedChange?.(event.target.checked)}
                data-testid="risk-acknowledgment"
              />
            }
            label={t('request.action.acknowledge')}
          />
        </ConsentBox>
      </Content>
      <ButtonsContainer>
        <Button variant="outlined" disabled={isLoading} onClick={onDeny} data-testid="action-deny-button">
          {t('common.deny')}
        </Button>
        <Button
          variant="contained"
          color="primary"
          disabled={approveBlocked || !readToEnd}
          onClick={onApprove}
          data-testid="action-approve-button"
        >
          {isLoading ? <CircularProgress size={20} color="inherit" /> : t('common.allow')}
        </Button>
      </ButtonsContainer>
    </Container>
  )
}
