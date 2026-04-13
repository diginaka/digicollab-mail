// MailerLite API ヘルパー
// すべてのAPIコールはこのヘルパー経由で行う
// ブラウザから直接呼び出し（MailerLite側でCORS許可済み）

const MAILERLITE_BASE = 'https://connect.mailerlite.com/api'

export class MailerLiteError extends Error {
  constructor(message, status, retryAfter) {
    super(message)
    this.name = 'MailerLiteError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

export async function mlFetch(apiKey, endpoint, options = {}) {
  if (!apiKey) {
    throw new MailerLiteError('APIキーが設定されていません', 401)
  }

  const res = await fetch(`${MAILERLITE_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
  })

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10)
    throw new MailerLiteError(
      `レート制限に達しました。${retryAfter}秒後に再試行してください。`,
      429,
      retryAfter
    )
  }

  if (res.status === 401) {
    throw new MailerLiteError('APIキーが無効です。設定画面から再設定してください。', 401)
  }

  if (!res.ok) {
    let msg = `APIエラー: ${res.status}`
    try {
      const err = await res.json()
      if (err.message) msg = err.message
    } catch {}
    throw new MailerLiteError(msg, res.status)
  }

  if (res.status === 204) return null
  return res.json()
}

// ==== アカウント ====
export function getAccount(apiKey) {
  // MailerLite API: /me エンドポイントでアカウント情報取得
  return mlFetch(apiKey, '/me')
}

// ==== 登録者 ====
export function listSubscribers(apiKey, { limit = 25, page = 1, status, search } = {}) {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('page', String(page))
  if (status) params.set('filter[status]', status)
  if (search) params.set('filter[search]', search)
  return mlFetch(apiKey, `/subscribers?${params.toString()}`)
}

export function getSubscriber(apiKey, idOrEmail) {
  return mlFetch(apiKey, `/subscribers/${encodeURIComponent(idOrEmail)}`)
}

export function createSubscriber(apiKey, data) {
  return mlFetch(apiKey, '/subscribers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateSubscriber(apiKey, id, data) {
  return mlFetch(apiKey, `/subscribers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteSubscriber(apiKey, id) {
  return mlFetch(apiKey, `/subscribers/${id}`, { method: 'DELETE' })
}

export function getSubscriberCount(apiKey) {
  return mlFetch(apiKey, '/subscribers?limit=1')
}

// ==== グループ ====
export function listGroups(apiKey, { limit = 50 } = {}) {
  return mlFetch(apiKey, `/groups?limit=${limit}`)
}

export function createGroup(apiKey, name) {
  return mlFetch(apiKey, '/groups', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function assignToGroup(apiKey, subscriberId, groupId) {
  return mlFetch(apiKey, `/subscribers/${subscriberId}/groups/${groupId}`, {
    method: 'POST',
  })
}

export function removeFromGroup(apiKey, subscriberId, groupId) {
  return mlFetch(apiKey, `/subscribers/${subscriberId}/groups/${groupId}`, {
    method: 'DELETE',
  })
}

// ==== セグメント ====
export function listSegments(apiKey, { limit = 50 } = {}) {
  return mlFetch(apiKey, `/segments?limit=${limit}`)
}

// ==== キャンペーン ====
export function listCampaigns(apiKey, { limit = 25, status } = {}) {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  if (status) params.set('filter[status]', status)
  return mlFetch(apiKey, `/campaigns?${params.toString()}`)
}

export function getCampaign(apiKey, id) {
  return mlFetch(apiKey, `/campaigns/${id}`)
}

export function createCampaign(apiKey, data) {
  return mlFetch(apiKey, '/campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function scheduleCampaign(apiKey, id, scheduleData) {
  return mlFetch(apiKey, `/campaigns/${id}/schedule`, {
    method: 'POST',
    body: JSON.stringify(scheduleData),
  })
}

export function cancelCampaign(apiKey, id) {
  return mlFetch(apiKey, `/campaigns/${id}/cancel`, { method: 'POST' })
}

// ==== オートメーション ====
export function listAutomations(apiKey, { limit = 50 } = {}) {
  return mlFetch(apiKey, `/automations?limit=${limit}`)
}

export function getAutomation(apiKey, id) {
  return mlFetch(apiKey, `/automations/${id}`)
}

// ==== フォーム ====
export function listForms(apiKey, type = 'popup', { limit = 50 } = {}) {
  return mlFetch(apiKey, `/forms/${type}?limit=${limit}`)
}

// ==== カスタムフィールド ====
export function listFields(apiKey) {
  return mlFetch(apiKey, '/fields')
}
