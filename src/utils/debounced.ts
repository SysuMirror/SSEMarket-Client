import { showMsg } from "@/components/MessageBox";
const MIN_CLICK_GAP = 1000

// 防抖函数（第一次点击有效）
export function debounce<T extends (...args: any[]) => void>(
  fn: T
): (...args: Parameters<T>) => void {
  let lastClickTime = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastClickTime >= MIN_CLICK_GAP) {
      lastClickTime = now;
      fn(...args);
    }
  };
}

// 异步防抖：短间隔内忽略；同一次包装内若有请求尚未结束则拒绝（避免慢网时重复提交）
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  let lastClickTime = 0
  let inFlight = false

  return async (...args: Parameters<T>) => {
    if (inFlight) {
      showMsg('提交中，请稍候…')
      return undefined
    }
    const now = Date.now()
    if (now - lastClickTime < MIN_CLICK_GAP) {
      showMsg('操作太频繁，请稍后再试')
      return undefined
    }
    lastClickTime = now
    inFlight = true
    try {
      return await fn(...args)
    }
    finally {
      inFlight = false
    }
  }
}
