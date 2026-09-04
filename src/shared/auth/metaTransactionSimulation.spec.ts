import { buildMetaTransactionSimulationPayload } from './metaTransactionSimulation'

describe('buildMetaTransactionSimulationPayload', () => {
  describe('when building the preview of a meta-transaction inner call', () => {
    let contract: string
    let calldata: string
    let user: string

    beforeEach(() => {
      contract = '0xa40b1d129b8906888720686f3a01921ddf37716f'
      calldata = `0xa9059cbb${'00'.repeat(64)}`
      user = '0xD9B96b5Dc720fC52bEDE1eC3B40a930E15f70DdD'
    })

    it('should make the contract call itself, as the relay does', () => {
      expect(buildMetaTransactionSimulationPayload(137, contract, calldata, user)).toMatchObject({ from: contract, to: contract })
    })

    it('should append the user address as the trailing 20 bytes of the calldata, lowercased', () => {
      expect(buildMetaTransactionSimulationPayload(137, contract, calldata, user).data).toBe(`${calldata}${user.slice(2).toLowerCase()}`)
    })

    it('should simulate on the given chain without value because the relay forwards none', () => {
      expect(buildMetaTransactionSimulationPayload(80002, contract, calldata, user)).toMatchObject({ chainId: 80002, value: '0' })
    })
  })

  describe('when the user address has no 0x prefix', () => {
    let user: string

    beforeEach(() => {
      user = 'd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
    })

    it('should still append exactly 20 bytes', () => {
      expect(buildMetaTransactionSimulationPayload(137, '0xa40b1d129b8906888720686f3a01921ddf37716f', '0xdeadbeef', user).data).toBe(
        `0xdeadbeef${user}`
      )
    })
  })

  describe('when the user address has an uppercase 0X prefix', () => {
    let user: string

    beforeEach(() => {
      user = '0XD9B96b5Dc720fC52bEDE1eC3B40a930E15f70DdD'
    })

    it('should strip the 0X prefix and append the bare lowercased 20 bytes', () => {
      expect(buildMetaTransactionSimulationPayload(137, '0xa40b1d129b8906888720686f3a01921ddf37716f', '0xdeadbeef', user).data).toBe(
        `0xdeadbeef${user.slice(2).toLowerCase()}`
      )
    })
  })
})
