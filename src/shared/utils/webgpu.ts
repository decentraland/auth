export async function checkWebGpuSupport(): Promise<boolean> {
  if (!('gpu' in navigator)) {
    return false
  }

  try {
    const adapter = await (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()
    return !!adapter
  } catch {
    return false
  }
}
