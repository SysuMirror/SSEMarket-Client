async function recordVideoPlayed(id: number): Promise<void> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/videos/${id}/played`, {
    method: 'POST',
  })
  if (!response.ok)
    throw new Error('网络错误')
  const data = await response.json()
  if (data.code !== 200)
    throw new Error(data.msg || '播放记录失败')
}

export { recordVideoPlayed }
