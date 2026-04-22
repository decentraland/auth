// Prefetch cache for the Celebrate Lottie animation (16 MB).
// Start fetching when QuickSetupPage mounts so it's ready
// by the time the user submits and sees the celebration screen.

let prefetchPromise: Promise<unknown> | null = null

function prefetchCelebrateAnimation(): void {
  if (prefetchPromise) return
  prefetchPromise = import('../../../assets/animations/Celebrate_Lottie.json').then(m => m.default)
}

function getCelebrateAnimation(): Promise<unknown> {
  if (!prefetchPromise) {
    prefetchPromise = import('../../../assets/animations/Celebrate_Lottie.json').then(m => m.default)
  }
  return prefetchPromise
}

export { prefetchCelebrateAnimation, getCelebrateAnimation }
