import { requestFunc } from '../req'

export async function toggleWatchPost(
  postID: number,
  userTelephone: string,
): Promise<{ ok: boolean, msg: string, watched: boolean }> {
  const res = await requestFunc('/auth/toggleWatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { postID, userTelephone },
  }, true)
  if (!res) {
    return { ok: false, msg: '请求失败', watched: false }
  }
  const json = await res.json()
  const watched = json.data?.watched === true
  return {
    ok: json.code === 200,
    msg: json.msg || (json.code === 200 ? '操作成功' : '操作失败'),
    watched,
  }
}
