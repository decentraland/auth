import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'

// Raise the async-util timeout (findBy*/waitFor) above the 1s default so heavy React component
// suites don't spuriously time out when the machine is saturated running many workers in parallel.
// This only extends the maximum wait; fast-resolving queries are unaffected.
configure({ asyncUtilTimeout: 5000 })
