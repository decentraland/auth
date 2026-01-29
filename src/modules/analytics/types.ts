export enum TrackingEvents {
  LOGIN_CLICK = 'Click Login Button',
  LOGIN_SUCCESS = 'Login Success',
  LOGIN_ERROR = 'Login Error',
  CLICK = 'Click Button',
  AVATAR_EDIT_SUCCESS = 'Avatar Edit Success',
  TERMS_OF_SERVICE_SUCCESS = 'Terms of service success',
  REQUEST_EXPIRED = 'Expired request',
  REQUEST_LOADING_ERROR = 'Error loading request',
  REQUEST_INTERACTION = 'Request interaction',
  REQUEST_OUTCOME_SUCCESS = 'Request outcome sent successfully',
  REQUEST_OUTCOME_FAILED = 'Request outcome sent with error',
  DEEP_LINK_AUTH_SUCCESS = 'Deep link auth success',
  START_ADDING_NAME = 'Start adding name',
  START_ADDING_EMAIL = 'Start adding email',
  CHECK_TERMS_OF_SERVICE = 'Check terms of service',
  WEBGPU_SUPPORT_CHECK = 'WebGPU support check',

  // Filtered error tracking (for monitoring ignorable errors)
  ERROR_USER_REJECTED = 'Error User Rejected',
  ERROR_SESSION_STATE = 'Error Session State',
  ERROR_NETWORK_TRANSIENT = 'Error Network Transient',
  ERROR_WALLET_SESSION = 'Error Wallet Session',
  ERROR_BROWSER_ENVIRONMENT = 'Error Browser Environment'
}

export enum RequestInteractionType {
  VERIFY_SIGN_IN = 'Verify sign in',
  DEEP_LINK_SIGN_IN = 'Deep link sign in',
  WALLET_INTERACTION = 'Wallet interaction'
}

export enum ClickEvents {
  LEARN_MORE = 'Learn More',
  DENY_SIGN_IN = 'Deny Sign In',
  DENY_WALLET_INTERACTION = 'Deny Wallet Interaction',
  APPROVE_SING_IN = 'Approve Sign In',
  APPROVE_WALLET_INTERACTION = 'Approve Wallet Interaction',
  IDENTITY_DEEP_LINK_OPENED = 'Identity Deep Link Opened',
  RANDOMIZE = 'Randomize default profile',
  BACK_TO_AVATAR_RANDOMIZATION_VIEW = 'Back to avatar randomization view',
  SUBMIT_PROFILE = 'Submit profile'
}

export enum ConnectionType {
  WEB3 = 'web3',
  WEB2 = 'web2',
  GUEST = 'guest'
}
