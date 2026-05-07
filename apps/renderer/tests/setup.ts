// Vitest setup for the renderer test suite.
// jsdom provides DOM globals; @testing-library/jest-dom adds custom matchers
// (toHaveStyle, toBeInTheDocument, etc.) for use in *.test.tsx files.

import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Vitest does not auto-cleanup the DOM between tests when `globals: false`.
// Without this, sibling .test.tsx tests in the same file leak rendered nodes
// into document.body and querySelector calls return stale matches.
afterEach(() => {
  cleanup()
})
