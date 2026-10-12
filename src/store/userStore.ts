import { computed, reactive } from 'vue'

const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000 - 1000 * 60 * 60
const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000

export interface UserInfo {
  userID: number
  name: string
  avatarURL: string
  phone: string
  email: string
  identity: string
  /** 站内币余额（来自 /auth/info 的 UserDto.coins） */
  coins: number
}

interface TokenInfo {
  value: string
  expiry: number
}

interface RefreshTokenInfo {
  value: string
  expiry: number
}

const userInfo = reactive<UserInfo>({
  userID: 0,
  name: '',
  avatarURL: '',
  phone: '',
  email: '',
  identity: '',
  coins: 0,
})
const tokenInfo = reactive<TokenInfo>({
  value: '',
  expiry: 0,
})

const refreshTokenInfo = reactive<RefreshTokenInfo>({
  value: '',
  expiry: 0,
})

const token = computed(() => {
  return tokenInfo.value
})

const refreshToken = computed(() => {
  const now = new Date()
  if (now.getTime() > refreshTokenInfo.expiry) {
    return ''
  }
  return refreshTokenInfo.value
})
const isLogin = computed(() => {
  return token.value.length > 0 && userInfo.userID > 0
})

function setToken(newToken: string) {
  const now = new Date()
  tokenInfo.value = newToken
  tokenInfo.expiry = newToken ? now.getTime() + SEVEN_DAYS_IN_MS : 0
}

function setRefreshToken(newToken: string) {
  const now = new Date()
  refreshTokenInfo.value = newToken
  refreshTokenInfo.expiry = newToken ? now.getTime() + THIRTY_DAYS_IN_MS : 0
  try {
    const rememberMe = localStorage.getItem('rememberMe')
    if (newToken && rememberMe === 'true') {
      localStorage.setItem('refreshToken', newToken)
      localStorage.setItem('refreshTokenExpiry', String(refreshTokenInfo.expiry))
    }
    else {
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('refreshTokenExpiry')
    }
  }
  catch {
    // ignore persistence errors
  }
}

;(() => {
  try {
    localStorage.removeItem('oneAPIKey')
    localStorage.removeItem('oneAPIModel')
    localStorage.removeItem('oneAPIKeyExpiry')
    const rememberMe = localStorage.getItem('rememberMe')
    if (rememberMe === 'true') {
      const storedRefreshToken = localStorage.getItem('refreshToken')
      const storedExpiry = localStorage.getItem('refreshTokenExpiry')
      if (storedRefreshToken && storedExpiry) {
        const expiryNum = Number(storedExpiry)
        if (!Number.isNaN(expiryNum) && expiryNum > Date.now()) {
          refreshTokenInfo.value = storedRefreshToken
          refreshTokenInfo.expiry = expiryNum
        }
      }
    }
  }
  catch {
    // ignore restore errors
  }
})()

function setUserInfo(newUserInfo: UserInfo) {
  Object.assign(userInfo, newUserInfo)
}
export function useUserStore() {
  return {
    token,
    refreshToken,
    isLogin,
    userInfo,
    setToken,
    setRefreshToken,
    setUserInfo,
  }
}
