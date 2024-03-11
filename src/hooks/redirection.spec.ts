import { Location, useLocation } from 'react-router-dom'
import { renderHook } from '@testing-library/react-hooks'
import { useAfterLoginRedirection } from './redirection'

jest.mock('react-router-dom')
type MockedUseLocation = jest.Mock<ReturnType<typeof useLocation>, Parameters<typeof useLocation>>
const mockedUseLocation = useLocation as MockedUseLocation

describe('when using the redirection hook', () => {
  afterEach(() => {
    mockedUseLocation.mockReset()
  })

  describe('and the redirectTo parameter is not present', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: '' } as Location)
    })

    it('should return the default site', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/')
    })
  })

  describe('and the redirectTo parameter points to another domain', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: 'redirectTo=https://test.com' } as Location)
    })

    it('should return the invalid redirection URL', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/auth/invalidRedirection')
    })
  })

  describe('and the redirectTo parameter points to a local path', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: 'redirectTo=/test' } as Location)
    })

    it('should return the local path using the current domain', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/test')
    })
  })

  describe('and the redirectTo parameter points to a local path URL encoded', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: 'redirectTo=%2Ftest' } as Location)
    })

    it('should return the local path using the current domain', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/test')
    })
  })

  describe('and the redirectTo parameter points to a malicious local path pointing to another domain', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: 'redirectTo=//test.com' } as Location)
    })

    it('should return the invalid redirection URL', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/auth/invalidRedirection')
    })
  })

  describe('and the redirectTo parameter points to a malicious local path pointing to another domain URL encoded', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: 'redirectTo=%2F%2Ftest.com' } as Location)
    })

    it('should return the invalid redirection URL', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/auth/invalidRedirection')
    })
  })

  describe('and the redirectTo parameter points to a double encoded malicious path', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: 'redirectTo=%252F%252Ftest.com' } as Location)
    })

    it('should return the invalid redirection URL', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/auth/invalidRedirection')
    })
  })

  describe('and the redirectTo parameter points to a malicious path using the @ character', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: 'redirectTo=/@test.com' } as Location)
    })

    it('should return the local path using the current domain', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/@test.com')
    })
  })

  describe('and the redirectTo parameter points to a URL maliciously crafted using the @ character', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: 'redirectTo=https://test.com/@localhost' } as Location)
    })

    it('should return the invalid redirection URL', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/auth/invalidRedirection')
    })
  })

  describe('and the redirectTo parameter points to a URL maliciously crafted using the / character URL encoded', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: 'redirectTo=https://example.com%5C%5C@localhost' } as Location)
    })

    it('should return the invalid redirection URL', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/auth/invalidRedirection')
    })
  })

  describe('and the redirectTo parameter points to a URL of the same domain of the site', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: 'redirectTo=http://localhost/test' } as Location)
    })

    it('should return the URL', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/test')
    })
  })
})
