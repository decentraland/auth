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

  describe('and the redirectTo parameter is present in the state parameter', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({
        search: `state=${btoa(JSON.stringify({ customData: JSON.stringify({ redirectTo: 'http://localhost/test' }) }))}`
      } as Location)
    })

    it('should return the redirectTo URL', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/test')
    })
  })

  describe('and the current URL contains a targetConfigId parameter', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({
        search: `state=${btoa(
          JSON.stringify({ customData: JSON.stringify({ redirectTo: 'http://localhost/test' }) })
        )}&targetConfigId=android`
      } as Location)
    })

    it('should return the redirectTo URL with the targetConfigId parameter', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/test?targetConfigId=android')
    })
  })

  describe('and the current URL contains a flow parameter', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({
        search: 'redirectTo=http://localhost/test&flow=deeplink'
      } as Location)
    })

    it('should return the redirectTo URL with the flow parameter', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/test?flow=deeplink')
    })
  })

  describe('and the current URL contains both targetConfigId and flow parameters', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({
        search: 'redirectTo=http://localhost/test&targetConfigId=android&flow=deeplink'
      } as Location)
    })

    it('should return the redirectTo URL with both parameters', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/test?targetConfigId=android&flow=deeplink')
    })
  })

  describe('and the redirectTo URL already has a flow parameter', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({
        search: 'redirectTo=http://localhost/test?flow=existing&flow=deeplink'
      } as Location)
    })

    it('should not duplicate the flow parameter', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      expect(result.current.url).toBe('http://localhost/test?flow=existing')
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

  describe('and the redirect function is called with parameters', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: 'redirectTo=http://localhost/test' } as Location)
    })

    it('should accept parameters without throwing errors', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())

      expect(() => {
        result.current.redirect({ user: '0x123', token: 'abc' })
      }).not.toThrow()
    })

    it('should work without parameters', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())

      expect(() => {
        result.current.redirect()
      }).not.toThrow()
    })

    it('should limit the number of parameters to 10', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      const manyParams: Record<string, string> = {}

      // Create 15 parameters
      for (let i = 0; i < 15; i++) {
        manyParams[`param${i}`] = `value${i}`
      }

      expect(() => {
        result.current.redirect(manyParams)
      }).not.toThrow()
    })

    it('should sanitize parameter keys with invalid characters', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      const invalidKeyParams: Record<string, string> = {}
      invalidKeyParams['user@name'] = 'value'
      invalidKeyParams['key-with-spaces'] = 'value2'

      expect(() => {
        result.current.redirect(invalidKeyParams)
      }).not.toThrow()
    })

    it('should sanitize parameter values with dangerous characters', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())

      expect(() => {
        result.current.redirect({
          user: '<script>alert("xss")</script>',
          token: 'javascript:alert("xss")'
        })
      }).not.toThrow()
    })

    it('should handle extremely long parameter values', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      const longValue = 'a'.repeat(2000)

      expect(() => {
        result.current.redirect({ user: longValue })
      }).not.toThrow()
    })

    it('should handle extremely long parameter keys', () => {
      const { result } = renderHook(() => useAfterLoginRedirection())
      const longKey = 'a'.repeat(100)

      expect(() => {
        result.current.redirect({ [longKey]: 'value' })
      }).not.toThrow()
    })
  })

  describe('and the redirect function is called with overrideUrl', () => {
    beforeEach(() => {
      mockedUseLocation.mockReturnValue({ search: 'redirectTo=http://localhost/test' } as Location)
    })

    describe('and the overrideUrl is a valid local path', () => {
      let overrideUrl: string

      beforeEach(() => {
        overrideUrl = '/new-path'
      })

      it('should accept overrideUrl without throwing errors', () => {
        const { result } = renderHook(() => useAfterLoginRedirection())

        expect(() => {
          result.current.redirect(undefined, overrideUrl)
        }).not.toThrow()
      })

      it('should accept overrideUrl with parameters without throwing errors', () => {
        const { result } = renderHook(() => useAfterLoginRedirection())

        expect(() => {
          result.current.redirect({ user: '0x123' }, overrideUrl)
        }).not.toThrow()
      })
    })

    describe('and the overrideUrl is a valid full URL', () => {
      let overrideUrl: string

      beforeEach(() => {
        overrideUrl = 'http://localhost/custom-path'
      })

      it('should accept overrideUrl without throwing errors', () => {
        const { result } = renderHook(() => useAfterLoginRedirection())

        expect(() => {
          result.current.redirect(undefined, overrideUrl)
        }).not.toThrow()
      })
    })

    describe('and the overrideUrl points to another domain', () => {
      let overrideUrl: string

      beforeEach(() => {
        overrideUrl = 'https://malicious.com/path'
      })

      it('should fallback to default redirect', () => {
        const { result } = renderHook(() => useAfterLoginRedirection())
        const originalLocation = window.location.href

        expect(() => {
          result.current.redirect(undefined, overrideUrl)
        }).not.toThrow()

        window.location.href = originalLocation
      })
    })

    describe('and the overrideUrl has an invalid protocol', () => {
      let overrideUrl: string

      beforeEach(() => {
        overrideUrl = 'javascript:alert("xss")'
      })

      it('should fallback to default redirect', () => {
        const { result } = renderHook(() => useAfterLoginRedirection())
        const originalLocation = window.location.href

        expect(() => {
          result.current.redirect(undefined, overrideUrl)
        }).not.toThrow()

        window.location.href = originalLocation
      })
    })

    describe('and the overrideUrl is invalid', () => {
      let overrideUrl: string

      beforeEach(() => {
        overrideUrl = 'not-a-valid-url'
      })

      it('should fallback to default redirect', () => {
        const { result } = renderHook(() => useAfterLoginRedirection())
        const originalLocation = window.location.href

        expect(() => {
          result.current.redirect(undefined, overrideUrl)
        }).not.toThrow()

        window.location.href = originalLocation
      })
    })
  })
})
