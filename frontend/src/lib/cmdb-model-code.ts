export function decodeModelCodeOnce(modelCode: string): string {
  try {
    return decodeURIComponent(modelCode)
  } catch {
    return modelCode
  }
}
