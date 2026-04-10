import { useLocation } from 'react-router-dom'
import { renderHook } from '@testing-library/react'
import { ConnectionOptionType } from '../components/Connection'
import { isIos, isMobile } from '../components/Pages/LoginPage/utils'
import { _targetConfigs, useTargetConfig } from './targetConfig'

jest.mock('react-router-dom')
jest.mock('../components/Pages/LoginPage/utils')

describe('useTargetConfig', () => {
  const mockLocation = { search: '' }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useLocation as jest.Mock).mockReturnValue(mockLocation)
  })

  describe('when no targetConfigId is provided', () => {
    beforeEach(() => {
      ;(isMobile as jest.Mock).mockReturnValue(false)
    })

    it('should return the default config', () => {
      const { result } = renderHook(() => useTargetConfig())
      const [config, targetConfigId] = result.current

      expect(targetConfigId).toBe('default')
      expect(config).toEqual(_targetConfigs.default)
    })
  })

  describe('when a targetConfigId is provided through the redirectTo parameter', () => {
    beforeEach(() => {
      ;(useLocation as jest.Mock).mockReturnValue({
        search: `state=${btoa(JSON.stringify({ customData: JSON.stringify({ redirectTo: 'http://localhost/test?targetConfigId=ios' }) }))}`
      })
      ;(isMobile as jest.Mock).mockReturnValue(false)
    })

    it('should return the ios config', () => {
      const { result } = renderHook(() => useTargetConfig())
      const [config, targetConfigId] = result.current

      expect(targetConfigId).toBe('ios')
      expect(config).toEqual(_targetConfigs.ios)
    })
  })

  describe('when a targetConfigId is provided as ios', () => {
    beforeEach(() => {
      ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=ios' })
      ;(isMobile as jest.Mock).mockReturnValue(false)
    })

    it('should return the ios config', () => {
      const { result } = renderHook(() => useTargetConfig())
      const [config, targetConfigId] = result.current

      expect(targetConfigId).toBe('ios')
      expect(config).toEqual(_targetConfigs.ios)
    })
  })

  describe('when a targetConfigId is provided as android', () => {
    beforeEach(() => {
      ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=android' })
      ;(isMobile as jest.Mock).mockReturnValue(false)
    })

    it('should return the android config', () => {
      const { result } = renderHook(() => useTargetConfig())
      const [config, targetConfigId] = result.current

      expect(targetConfigId).toBe('android')
      expect(config).toEqual(_targetConfigs.android)
    })
  })

  describe('when on mobile, the targetConfigId override is ignored', () => {
    beforeEach(() => {
      ;(isMobile as jest.Mock).mockReturnValue(true)
    })

    it('should resolve to the android config when ?targetConfigId=default and not iOS', () => {
      ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=default' })
      ;(isIos as jest.Mock).mockReturnValue(false)

      const { result } = renderHook(() => useTargetConfig())
      const [config, targetConfigId] = result.current

      expect(targetConfigId).toBe('android')
      expect(config).toEqual(_targetConfigs.android)
    })

    it('should resolve to the ios config when ?targetConfigId=alternative and on iOS', () => {
      ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=alternative' })
      ;(isIos as jest.Mock).mockReturnValue(true)

      const { result } = renderHook(() => useTargetConfig())
      const [config, targetConfigId] = result.current

      expect(targetConfigId).toBe('ios')
      expect(config).toEqual(_targetConfigs.ios)
    })
  })

  describe('when an invalid targetConfigId is provided', () => {
    beforeEach(() => {
      ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=invalid' })
      ;(isMobile as jest.Mock).mockReturnValue(false)
    })

    it('should return the default config', () => {
      const { result } = renderHook(() => useTargetConfig())
      const [config, targetConfigId] = result.current

      expect(targetConfigId).toBe('default')
      expect(config).toEqual(_targetConfigs.default)
    })
  })

  describe('when on iOS mobile with no targetConfigId', () => {
    beforeEach(() => {
      ;(useLocation as jest.Mock).mockReturnValue({ search: '' })
      ;(isMobile as jest.Mock).mockReturnValue(true)
      ;(isIos as jest.Mock).mockReturnValue(true)
    })

    it('should return the ios config', () => {
      const { result } = renderHook(() => useTargetConfig())
      const [config, targetConfigId] = result.current

      expect(targetConfigId).toBe('ios')
      expect(config.connectionOptions.primary).toBe(ConnectionOptionType.APPLE)
      expect(config.connectionOptions.secondary).toBe(ConnectionOptionType.GOOGLE)
    })
  })

  describe('when on Android mobile with no targetConfigId', () => {
    beforeEach(() => {
      ;(useLocation as jest.Mock).mockReturnValue({ search: '' })
      ;(isMobile as jest.Mock).mockReturnValue(true)
      ;(isIos as jest.Mock).mockReturnValue(false)
    })

    it('should return the android config', () => {
      const { result } = renderHook(() => useTargetConfig())
      const [config, targetConfigId] = result.current

      expect(targetConfigId).toBe('android')
      expect(config.connectionOptions.primary).toBe(ConnectionOptionType.GOOGLE)
      expect(config.connectionOptions.secondary).toBe(ConnectionOptionType.APPLE)
    })
  })
})
