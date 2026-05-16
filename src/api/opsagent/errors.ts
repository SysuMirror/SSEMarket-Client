interface ParsedOpsAgentError {
  code?: number
  msg: string
}

export function parseOpsAgentJsonError(text: string): ParsedOpsAgentError {
  const raw = text || ''
  try {
    const j = JSON.parse(raw) as { code?: number, msg?: string, message?: string }
    const msg = (j.msg || j.message || raw).trim() || '请求失败'
    const code = typeof j.code === 'number' ? j.code : undefined
    return { code, msg }
  }
  catch {
    return { msg: raw.trim() || '请求失败' }
  }
}

export class OpsAgentRequestError extends Error {
  readonly httpStatus: number
  readonly businessCode?: number

  constructor(httpStatus: number, message: string, businessCode?: number) {
    super(message)
    this.name = 'OpsAgentRequestError'
    this.httpStatus = httpStatus
    this.businessCode = businessCode
  }
}

/** 会话失效或未 bootstrap 等，可尝试重新 GET conversation/bootstrap。 */
export function shouldRebootstrapAfterTaskError(code?: number, msg?: string): boolean {
  if (code === 40301)
    return true
  if (code === 40001 && msg && /session|会话|bootstrap/i.test(msg))
    return true
  return false
}
