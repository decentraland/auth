import { useNavigate, useLocation } from 'react-router-dom'
import { renderHook, act } from '@testing-library/react-hooks'
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

  it('navigates to the given path without modifying search params when targetConfigId is not present', () => {
    const { result } = renderHook(() => useNavigateWithSearchParams())

    act(() => {
      result.current('/test-path')
    })

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/test-path',
      search: undefined
    })
  })

  it('navigates to the given path with its own search params when targetConfigId is not present', () => {
    const { result } = renderHook(() => useNavigateWithSearchParams())

    act(() => {
      result.current('/test-path?param1=value1&param2=value2')
    })

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/test-path',
      search: '?param1=value1&param2=value2'
    })
  })

  it('navigates to the given path and appends targetConfigId when it is present in current location', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=123' })

    const { result } = renderHook(() => useNavigateWithSearchParams())

    act(() => {
      result.current('/test-path')
    })

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/test-path',
      search: '?targetConfigId=123'
    })
  })

  it('navigates to the given path and merges targetConfigId with existing search params', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=123' })

    const { result } = renderHook(() => useNavigateWithSearchParams())

    act(() => {
      result.current('/test-path?param1=value1')
    })

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/test-path',
      search: '?param1=value1&targetConfigId=123'
    })
  })

  it('navigates to the given path and overwrites targetConfigId with the one from current location', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=123' })

    const { result } = renderHook(() => useNavigateWithSearchParams())

    act(() => {
      result.current('/test-path?param1=value1&targetConfigId=456')
    })

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/test-path',
      search: '?param1=value1&targetConfigId=123'
    })
  })

  it('navigates to the given path and correctly merges multiple search params with targetConfigId', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=123' })

    const { result } = renderHook(() => useNavigateWithSearchParams())

    act(() => {
      result.current('/test-path?param1=value1&param2=value2')
    })

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/test-path',
      search: '?param1=value1&param2=value2&targetConfigId=123'
    })
  })

  it('navigates to the given path and keeps its own targetConfigId when none is present in current location', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '' })

    const { result } = renderHook(() => useNavigateWithSearchParams())

    act(() => {
      result.current('/test-path?targetConfigId=456')
    })

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/test-path',
      search: '?targetConfigId=456'
    })
  })

  it('does not include other search params from current location besides targetConfigId', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=123&otherParam=abc' })

    const { result } = renderHook(() => useNavigateWithSearchParams())

    act(() => {
      result.current('/test-path')
    })

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/test-path',
      search: '?targetConfigId=123'
    })
  })

  it('navigates correctly when provided path is a full URL', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '' })

    const { result } = renderHook(() => useNavigateWithSearchParams())

    act(() => {
      result.current('http://localhost/test-path?param1=value1')
    })

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/test-path',
      search: '?param1=value1'
    })
  })

  it('navigates correctly when provided path is a full URL with different origin', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '' })

    const { result } = renderHook(() => useNavigateWithSearchParams())

    act(() => {
      result.current('http://example.com/test-path?param1=value1')
    })

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/test-path',
      search: '?param1=value1'
    })
  })

  it('throws an error when provided path is a malformed URL', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '' })

    const { result } = renderHook(() => useNavigateWithSearchParams())

    expect(() => {
      act(() => {
        result.current('http://')
      })
    }).toThrow('Invalid path provided')
  })

  it('navigates correctly when provided path is a relative path', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '' })

    const { result } = renderHook(() => useNavigateWithSearchParams())

    act(() => {
      result.current('test-path')
    })

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/test-path',
      search: undefined
    })
  })

  it('encodes targetConfigId when it has special characters', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=%2F%2Fmalicious.com' })

    const { result } = renderHook(() => useNavigateWithSearchParams())

    act(() => {
      result.current('/test-path')
    })

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/test-path',
      search: '?targetConfigId=%2F%2Fmalicious.com'
    })
  })

  it('throws an error when navigate is called with an empty path', () => {
    const { result } = renderHook(() => useNavigateWithSearchParams())

    expect(() => {
      act(() => {
        result.current('')
      })
    }).toThrow('Path cannot be empty')
  })
})
