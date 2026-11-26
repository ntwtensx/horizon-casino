const BASE = '/api/casino';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'รูปแบบข้อมูลเซิร์ฟเวอร์ไม่ถูกต้อง' }));
  if (!res.ok && data.ok !== false) {
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  }
  return data;
}

export const casinoApi = {
  init: () => request(`/init?t=${Date.now()}`),
  register: (displayName, pin, confirmPin, avatarUrl) =>
    request('/register', {
      method: 'POST',
      body: JSON.stringify({ displayName, pin, confirmPin, avatarUrl })
    }),
  setPin: (userId, pin, confirmPin) =>
    request('/set-pin', {
      method: 'POST',
      body: JSON.stringify({ userId, pin, confirmPin })
    }),
  verifyPin: (userId, pin) =>
    request('/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ userId, pin })
    }),
  spin: (userId, pin) =>
    request('/spin', {
      method: 'POST',
      body: JSON.stringify({ userId, pin })
    }),
  deposit: (userId, pin, amount) =>
    request('/bank/deposit', {
      method: 'POST',
      body: JSON.stringify({ userId, pin, amount })
    }),
  withdraw: (userId, pin, amount) =>
    request('/bank/withdraw', {
      method: 'POST',
      body: JSON.stringify({ userId, pin, amount })
    }),
  getTransactions: (userId) =>
    request(`/transactions/${encodeURIComponent(userId)}?t=${Date.now()}`)
};