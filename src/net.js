// 带超时的 fetch：上游偶发 hang 住时快速失败，而不是无限等待。
export async function fetchWithTimeout(url, options = {}, ms = 20000) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(ms) });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error(`请求超时（${Math.round(ms / 1000)} 秒无响应）`);
    }
    throw error;
  }
}
