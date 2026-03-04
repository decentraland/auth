import { useLocation, useNavigate } from 'react-router-dom'
import { act, renderHook } from '@testing-library/react'
import { useNavigateWithSearchParams } from './navigation'

jest.mock('react-router-dom')

describe('useNavigateWithSearchParams', () => {
  const mockNavigate = jest.fn()
  const mockLocation = { search: '' }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useNavigate as jest.Mock).mockReturnValue(mockNavigate)
    ;(useLocation as jest.Mock).mockReturnValue(mockLocation)
  })

  describe('when targetConfigId parameter is not present', () => {
    beforeEach(() => {
      ;(useLocation as jest.Mock).mockReturnValue({ search: '' })
    })

    it('should navigate to the given path without modifying search params', () => {
      const { result } = renderHook(() => useNavigateWithSearchParams())

      act(() => {
        result.current('/test-path')
      })

      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/test-path',
        search: undefined
      })
    })

    it('should navigate to the given path with its own search params', () => {
      const { result } = renderHook(() => useNavigateWithSearchParams())

      act(() => {
        result.current('/test-path?param1=value1&param2=value2')
      })

      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/test-path',
        search: '?param1=value1&param2=value2'
      })
    })
  })

  describe('when targetConfigId parameter is present', () => {
    beforeEach(() => {
      ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=123' })
    })

    it('should append targetConfigId to the given path', () => {
      const { result } = renderHook(() => useNavigateWithSearchParams())

      act(() => {
        result.current('/test-path')
      })

      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/test-path',
        search: '?targetConfigId=123'
      })
    })

    it('should merge targetConfigId with existing search params', () => {
      const { result } = renderHook(() => useNavigateWithSearchParams())

      act(() => {
        result.current('/test-path?param1=value1')
      })

      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/test-path',
        search: '?param1=value1&targetConfigId=123'
      })
    })

    it('should overwrite targetConfigId in the path with the one from current location', () => {
      const { result } = renderHook(() => useNavigateWithSearchParams())

      act(() => {
        result.current('/test-path?param1=value1&targetConfigId=456')
      })

      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/test-path',
        search: '?param1=value1&targetConfigId=123'
      })
    })

    it('should correctly merge multiple search params with targetConfigId', () => {
      const { result } = renderHook(() => useNavigateWithSearchParams())

      act(() => {
        result.current('/test-path?param1=value1&param2=value2')
      })

      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/test-path',
        search: '?param1=value1&param2=value2&targetConfigId=123'
      })
    })
  })

  describe('when navigating with different path formats', () => {
    it('should handle full URLs with different origins', () => {
      const { result } = renderHook(() => useNavigateWithSearchParams())

      act(() => {
        result.current('http://example.com/test-path?param1=value1')
      })

      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/test-path',
        search: '?param1=value1'
      })
    })

    it('should navigate correctly with a relative path', () => {
      const { result } = renderHook(() => useNavigateWithSearchParams())

      act(() => {
        result.current('test-path')
      })

      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/test-path',
        search: undefined
      })
    })
  })

  describe('when targetConfigId parameter has special characters', () => {
    beforeEach(() => {
      ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=%2F%2Fmalicious.com' })
    })

    it('should encode targetConfigId with special characters', () => {
      const { result } = renderHook(() => useNavigateWithSearchParams())

      act(() => {
        result.current('/test-path')
      })

      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/test-path',
        search: '?targetConfigId=%2F%2Fmalicious.com'
      })
    })
  })

  describe('when handling errors in navigation', () => {
    it('should throw an error when provided path is malformed', () => {
      const { result } = renderHook(() => useNavigateWithSearchParams())

      expect(() => {
        act(() => {
          result.current('http://')
        })
      }).toThrow('Invalid path provided')
    })

    it('should throw an error for empty path', () => {
      const { result } = renderHook(() => useNavigateWithSearchParams())

      expect(() => {
        act(() => {
          result.current('')
        })
      }).toThrow('Path cannot be empty')
    })
  })
})
