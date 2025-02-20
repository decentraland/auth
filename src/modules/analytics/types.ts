export enum TrackingEvents {
  LOGIN_CLICK = 'Click Login Button',
  LOGIN_SUCCESS = 'Login Success',
  LOGIN_ERROR = 'Login Error',
  CLICK = 'Click Button',
  AVATAR_EDIT_SUCCESS = 'Avatar Edit Success',
  TERMS_OF_SERVICE_SUCCESS = 'Terms of service success',
  REQUEST_EXPIRED = 'Expired request',
  REQUEST_LOADING_ERROR = 'Error loading request',
  WALLET_INTERACTION_REQUEST_TYPE = 'Wallet interaction request type',
  VERIFY_SIGN_IN_REQUEST_TYPE = 'Verify sign in request type'
}

export enum ClickEvents {
  LEARN_MORE = 'Learn More',
  DENY_SIGN_IN = 'Deny Sign In',
  DENY_WALLET_INTERACTION = 'Deny Wallet Interaction',
  APPROVE_SING_IN = 'Approve Sign In',
  APPROVE_WALLET_INTERACTION = 'Approve Wallet Interaction',
  RANDOMIZE = 'Randomize default profile',
  BACK_TO_AVATAR_RANDOMIZATION_VIEW = 'Back to avatar randomization view',
  SUBMIT_PROFILE = 'Submit profile'
}

export enum ConnectionType {
  WEB3 = 'web3',
  WEB2 = 'web2',
  GUEST = 'guest'
}
