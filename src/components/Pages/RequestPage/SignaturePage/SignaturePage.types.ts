import React from 'react'
import { Socket } from 'socket.io-client'

export type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: any
  socketRef: React.MutableRefObject<Socket | undefined>
}

export enum Step {
  WAITING_CLICK_ON_SIGN,
  WAITING_WALLET_SIGNATURE,
  SIGNATURE_SUBMITED
}
