/** OpsAgent 对外根路径（与主站同域反代或独立子域由环境变量决定）。 */
export function opsagentBaseURL(): string {
  return (import.meta.env.VITE_OPSAGENT_BASE_URL || window.location.origin).replace(/\/$/, '')
}
