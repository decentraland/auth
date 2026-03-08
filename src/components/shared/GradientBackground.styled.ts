import { SxProps, Theme } from 'decentraland-ui2'

/**
 * Shared gradient pseudo-element styles for page backgrounds.
 * Apply as `&::before` on the main page container.
 */
const gradientPseudoElement: SxProps<Theme> = {
  content: '""',
  position: 'fixed',
  width: '100%',
  height: '350%',
  top: '-100%',
  transform: 'rotate(180deg)',
  overflow: 'hidden'
}

/**
 * Desktop gradient: purple linear gradient (used by LoginPage).
 */
const desktopLinearGradient =
  'linear-gradient(89.65deg, rgba(149, 45, 198, 0) 29.59%, rgba(94, 30, 130, 0.559754) 39.08%, rgba(75, 25, 106, 0.750004) 45.36%, rgba(64, 23, 93, 0.859976) 54.22%, #32134C 72.84%)'

/**
 * Mobile gradient: simple purple gradient.
 */
const mobileLinearGradient = 'linear-gradient(151.89deg, #491975 47.67%, #D72CCD 103.3%)'

/**
 * Desktop radial gradient (used by MobileAuthPage).
 */
const desktopRadialGradient = 'radial-gradient(ellipse at 0 50%, transparent 10%, #e02dd3 40%, #491975 70%)'

/**
 * Mobile radial gradient (used by MobileAuthPage).
 */
const mobileRadialGradient = 'radial-gradient(ellipse at 0 50%, #e02dd3 0%, #491975 70%)'

export { gradientPseudoElement, desktopLinearGradient, mobileLinearGradient, desktopRadialGradient, mobileRadialGradient }
