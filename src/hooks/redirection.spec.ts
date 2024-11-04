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

  // Tests for targetConfigId

  // Test when redirectTo is not present but targetConfigId is present
  describe('and the redirectTo parameter is not present but targetConfigId is present', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: '?targetConfigId=123' } as Location)
    })

    it('should return the default site with targetConfigId appended', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/?targetConfigId=123')
    })
  })

  // Test when redirectTo points to another domain with targetConfigId present
  describe('and the redirectTo parameter points to another domain with targetConfigId', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: '?redirectTo=https://test.com&targetConfigId=123' } as Location)
    })

    it('should return the invalid redirection URL with targetConfigId appended', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/auth/invalidRedirection?targetConfigId=123')
    })
  })

  // Test when redirectTo points to a local path with targetConfigId present
  describe('and the redirectTo parameter points to a local path with targetConfigId', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: '?redirectTo=/test&targetConfigId=123' } as Location)
    })

    it('should return the local path with targetConfigId appended', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/test?targetConfigId=123')
    })
  })

  // Test when redirectTo is a URL-encoded local path with targetConfigId present
  describe('and the redirectTo parameter points to a local path URL encoded with targetConfigId', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: '?redirectTo=%2Ftest&targetConfigId=123' } as Location)
    })

    it('should return the local path with targetConfigId appended', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/test?targetConfigId=123')
    })
  })

  // Test when redirectTo includes targetConfigId, and targetConfigId is also present in current search
  describe('and the redirectTo parameter already includes targetConfigId, and targetConfigId is also present in current search', () => {
    beforeEach(() => {
      // The targetConfigId from current search should overwrite the one in redirectTo
      mockedUseLocation.mockReturnValue({ search: '?redirectTo=/test?targetConfigId=456&targetConfigId=123' } as Location)
    })

    it('should overwrite the targetConfigId in redirectTo with the one from current search', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/test?targetConfigId=123')
    })
  })

  // Test when redirectTo is malformed with targetConfigId present
  describe('and the redirectTo parameter is malformed with targetConfigId present', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: '?redirectTo=%%%&targetConfigId=123' } as Location)
    })

    it('should return the default site with targetConfigId appended', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/?targetConfigId=123')
    })
  })

  // Test when redirectTo is missing, targetConfigId has special characters
  describe('and the redirectTo parameter is missing but targetConfigId is present with special characters', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: '?targetConfigId=%40%23%24' } as Location)
    })

    it('should return the default site with targetConfigId URL-encoded correctly', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/?targetConfigId=%40%23%24')
    })
  })

  // Test when redirectTo is a malicious path and targetConfigId is present
  describe('and the redirectTo parameter points to a malicious path and targetConfigId is present', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: '?redirectTo=//test.com&targetConfigId=123' } as Location)
    })

    it('should return the invalid redirection URL with targetConfigId appended, preventing open redirects', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/auth/invalidRedirection?targetConfigId=123')
    })
  })

  // Test when redirectTo is safe, but targetConfigId is potentially malicious
  describe('and the redirectTo parameter points to a local path but targetConfigId is potentially malicious', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: '?redirectTo=/test&targetConfigId=//malicious.com' } as Location)
    })

    it('should append the potentially malicious targetConfigId to the URL, with the value URL-encoded', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      // The targetConfigId is URL-encoded by URLSearchParams
      expect(result.current.url).toBe('http://localhost/test?targetConfigId=%2F%2Fmalicious.com')
    })
  })

  // Test when both redirectTo and targetConfigId are missing
  describe('and both redirectTo and targetConfigId parameters are missing', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: '' } as Location)
    })

    it('should return the default site', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/')
    })
  })
})
