function buildTransactionParams(params: unknown[] | undefined): [Record<string, unknown>] {
  const [txParams] = params ?? []
  const source = txParams && typeof txParams === 'object' && !Array.isArray(txParams) ? (txParams as Record<string, unknown>) : {}
  return [{ to: source.to, data: source.data ?? '0x', value: source.value ?? '0x0' }]
}

export { buildTransactionParams }
