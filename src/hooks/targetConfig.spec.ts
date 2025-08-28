import { useLocation } from 'react-router-dom'
import { renderHook } from '@testing-library/react-hooks'
import { ConnectionOptionType } from '../components/Connection'
import { isMobile } from '../components/Pages/LoginPage/utils'
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

  describe('when a targetConfigId is provided as androidSocial', () => {
    beforeEach(() => {
      ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=androidSocial' })
      ;(isMobile as jest.Mock).mockReturnValue(false)
    })

    it('should return the androidSocial config', () => {
      const { result } = renderHook(() => useTargetConfig())
      const [config, targetConfigId] = result.current

      expect(targetConfigId).toBe('androidSocial')
      expect(config).toEqual(_targetConfigs.androidSocial)
    })
  })

  describe('when a targetConfigId is provided as androidWeb3', () => {
    beforeEach(() => {
      ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=androidWeb3' })
      ;(isMobile as jest.Mock).mockReturnValue(false)
    })

    it('should return the androidWeb3 config', () => {
      const { result } = renderHook(() => useTargetConfig())
      const [config, targetConfigId] = result.current

      expect(targetConfigId).toBe('androidWeb3')
      expect(config).toEqual(_targetConfigs.androidWeb3)
    })
  })

  describe('when a targetConfigId is provided as default', () => {
    beforeEach(() => {
      ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=default' })
      ;(isMobile as jest.Mock).mockReturnValue(true)
    })

    it('should return the default config', () => {
      const { result } = renderHook(() => useTargetConfig())
      const [config] = result.current

      expect(config.connectionOptions.primary).toBe(ConnectionOptionType.GOOGLE)
      expect(config.connectionOptions.secondary).toBe(ConnectionOptionType.WALLET_CONNECT)
      expect(config.connectionOptions.extraOptions).not.toContain(ConnectionOptionType.WALLET_CONNECT)
      expect(config.connectionOptions.extraOptions).not.toContain(ConnectionOptionType.METAMASK)
    })
  })

  describe('when a targetConfigId is provided as alternative', () => {
    beforeEach(() => {
      ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=alternative' })
      ;(isMobile as jest.Mock).mockReturnValue(true)
    })

    it('should return the alternative config', () => {
      const { result } = renderHook(() => useTargetConfig())
      const [config, targetConfigId] = result.current

      expect(targetConfigId).toBe('alternative')
      expect(config.connectionOptions.primary).toBe(ConnectionOptionType.GOOGLE)
      expect(config.connectionOptions.secondary).toBe(ConnectionOptionType.WALLET_CONNECT)
      expect(config.connectionOptions.extraOptions).not.toContain(ConnectionOptionType.WALLET_CONNECT)
      expect(config.connectionOptions.extraOptions).not.toContain(ConnectionOptionType.METAMASK)
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
})
