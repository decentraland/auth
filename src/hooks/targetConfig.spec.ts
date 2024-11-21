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

  it('returns default config when no targetConfigId is provided', () => {
    ;(isMobile as jest.Mock).mockReturnValue(false)

    const { result } = renderHook(() => useTargetConfig())
    const [config, targetConfigId] = result.current

    expect(targetConfigId).toBe('default')
    expect(config).toEqual(_targetConfigs.default)
  })

  it('returns ios config when targetConfigId=ios', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=ios' })
    ;(isMobile as jest.Mock).mockReturnValue(false)

    const { result } = renderHook(() => useTargetConfig())
    const [config, targetConfigId] = result.current

    expect(targetConfigId).toBe('ios')
    expect(config).toEqual(_targetConfigs.ios)
  })

  it('returns android config when targetConfigId=android', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=android' })
    ;(isMobile as jest.Mock).mockReturnValue(false)

    const { result } = renderHook(() => useTargetConfig())
    const [config, targetConfigId] = result.current

    expect(targetConfigId).toBe('android')
    expect(config).toEqual(_targetConfigs.android)
  })

  it('returns androidSocial config when targetConfigId=androidSocial', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=androidSocial' })
    ;(isMobile as jest.Mock).mockReturnValue(false)

    const { result } = renderHook(() => useTargetConfig())
    const [config, targetConfigId] = result.current

    expect(targetConfigId).toBe('androidSocial')
    expect(config).toEqual(_targetConfigs.androidSocial)
  })

  it('returns androidWeb3 config when targetConfigId=androidWeb3', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=androidWeb3' })
    ;(isMobile as jest.Mock).mockReturnValue(false)

    const { result } = renderHook(() => useTargetConfig())
    const [config, targetConfigId] = result.current

    expect(targetConfigId).toBe('androidWeb3')
    expect(config).toEqual(_targetConfigs.androidWeb3)
  })

  it('returns the mobile-adjusted config for default config on mobile', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=default' })
    ;(isMobile as jest.Mock).mockReturnValue(true)

    const { result } = renderHook(() => useTargetConfig())
    const [config] = result.current

    expect(config.connectionOptions.primary).toBe(ConnectionOptionType.GOOGLE)
    expect(config.connectionOptions.secondary).toBe(ConnectionOptionType.WALLET_CONNECT)
    expect(config.connectionOptions.extraOptions).not.toContain(ConnectionOptionType.WALLET_CONNECT)
    expect(config.connectionOptions.extraOptions).not.toContain(ConnectionOptionType.METAMASK)
  })

  it('applies mobile adjustments for all targetConfigId configurations', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=alternative' })
    ;(isMobile as jest.Mock).mockReturnValue(true)

    const { result } = renderHook(() => useTargetConfig())
    const [config, targetConfigId] = result.current

    expect(targetConfigId).toBe('alternative')
    expect(config.connectionOptions.primary).toBe(ConnectionOptionType.GOOGLE)
    expect(config.connectionOptions.secondary).toBe(ConnectionOptionType.WALLET_CONNECT)
    expect(config.connectionOptions.extraOptions).not.toContain(ConnectionOptionType.WALLET_CONNECT)
    expect(config.connectionOptions.extraOptions).not.toContain(ConnectionOptionType.METAMASK)
  })

  it('returns default config when an invalid targetConfigId is provided', () => {
    ;(useLocation as jest.Mock).mockReturnValue({ search: '?targetConfigId=invalid' })
    ;(isMobile as jest.Mock).mockReturnValue(false)

    const { result } = renderHook(() => useTargetConfig())
    const [config, targetConfigId] = result.current

    expect(targetConfigId).toBe('default')
    expect(config).toEqual(_targetConfigs.default)
  })
})
