// Brevo API ヘルパー
// すべてのAPIコールはこのヘルパー経由で行う
// ブラウザから直接呼び出し（Brevo側でCORS許可済み）

const BREVO_BASE = 'https://api.brevo.com/v3'

export class BrevoError extends Error {
  constructor(message, status, retryAfter) {
    super(message)
    this.name = 'BrevoError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

export async function brevoFetch(apiKey, endpoint, options = {}) {
  if (!apiKey) {
    throw new BrevoError('APIキーが設定されていません', 401)
  }

  const res = await fetch(`${BREVO_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'api-key': apiKey,
      ...(options.headers || {}),
    },
  })

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10)
    throw new BrevoError(
      `レート制限に達しました。${retryAfter}秒後に再試行してください。`,
      429,
      retryAfter
    )
  }

  if (res.status === 401) {
    throw new BrevoError('APIキーが無効です。設定画面から再設定してください。', 401)
  }

  if (!res.ok) {
    let msg = `APIエラー: ${res.status}`
    try {
      const err = await res.json()
      if (err.message) msg = err.message
    } catch {}
    throw new BrevoError(msg, res.status)
  }

  if (res.status === 204) return null
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// ==== アカウント ====
export async function getAccount(apiKey) {
  const data = await brevoFetch(apiKey, '/account')
  const planInfo = data.plan?.[0] || {}
  return {
    account_name:
      data.companyName ||
      [data.firstName, data.lastName].filter(Boolean).join(' ') ||
      data.email ||
      'Brevo アカウント',
    email: data.email || '',
    plan: planInfo.type || 'free',
    credits: planInfo.credits ?? 0,
    creditsType: planInfo.creditsType || '',
  }
}

// ==== コンタクト ====
export function listContacts(apiKey, { limit = 50, offset = 0, listIds, modifiedSince } = {}) {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  if (listIds) params.set('listIds', listIds)
  if (modifiedSince) params.set('modifiedSince', modifiedSince)
  return brevoFetch(apiKey, `/contacts?${params.toString()}`)
}

export function getContact(apiKey, emailOrId) {
  return brevoFetch(apiKey, `/contacts/${encodeURIComponent(emailOrId)}`)
}

export function createContact(apiKey, { email, attributes = {}, listIds = [], updateEnabled = true }) {
  return brevoFetch(apiKey, '/contacts', {
    method: 'POST',
    body: JSON.stringify({ email, attributes, listIds, updateEnabled }),
  })
}

export function updateContact(apiKey, email, { attributes = {}, listIds = [], unlinkListIds = [] }) {
  return brevoFetch(apiKey, `/contacts/${encodeURIComponent(email)}`, {
    method: 'PUT',
    body: JSON.stringify({ attributes, listIds, unlinkListIds }),
  })
}

export function deleteContact(apiKey, emailOrId) {
  return brevoFetch(apiKey, `/contacts/${encodeURIComponent(emailOrId)}`, {
    method: 'DELETE',
  })
}

// ==== リスト（MailerLiteの「グループ」に相当） ====
export function listLists(apiKey, { limit = 50, offset = 0 } = {}) {
  return brevoFetch(apiKey, `/contacts/lists?limit=${limit}&offset=${offset}`)
}

export function getList(apiKey, listId) {
  return brevoFetch(apiKey, `/contacts/lists/${listId}`)
}

export function createList(apiKey, name, folderId = 1) {
  return brevoFetch(apiKey, '/contacts/lists', {
    method: 'POST',
    body: JSON.stringify({ name, folderId }),
  })
}

export function deleteList(apiKey, listId) {
  return brevoFetch(apiKey, `/contacts/lists/${listId}`, { method: 'DELETE' })
}

export function getListContacts(apiKey, listId, { limit = 50, offset = 0 } = {}) {
  return brevoFetch(apiKey, `/contacts/lists/${listId}/contacts?limit=${limit}&offset=${offset}`)
}

export function addContactsToList(apiKey, listId, emails) {
  return brevoFetch(apiKey, `/contacts/lists/${listId}/contacts/add`, {
    method: 'POST',
    body: JSON.stringify({ emails }),
  })
}

export function removeContactsFromList(apiKey, listId, emails) {
  return brevoFetch(apiKey, `/contacts/lists/${listId}/contacts/remove`, {
    method: 'POST',
    body: JSON.stringify({ emails }),
  })
}

// ==== フォルダ ====
export function listFolders(apiKey, { limit = 50, offset = 0 } = {}) {
  return brevoFetch(apiKey, `/contacts/folders?limit=${limit}&offset=${offset}`)
}

// ==== 送信者（認証済み送信元） ====
export function listSenders(apiKey) {
  return brevoFetch(apiKey, '/senders')
}

// ==== テンプレート ====
export function listTemplates(apiKey, { limit = 50, offset = 0 } = {}) {
  return brevoFetch(apiKey, `/smtp/templates?limit=${limit}&offset=${offset}`)
}

export function getTemplate(apiKey, templateId) {
  return brevoFetch(apiKey, `/smtp/templates/${templateId}`)
}

export function createTemplate(apiKey, { templateName, subject, htmlContent, sender, isActive = true, tag }) {
  const body = { templateName, subject, htmlContent, sender, isActive }
  if (tag) body.tag = tag
  return brevoFetch(apiKey, '/smtp/templates', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateTemplate(apiKey, templateId, updates) {
  return brevoFetch(apiKey, `/smtp/templates/${templateId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

export function deleteTemplate(apiKey, templateId) {
  return brevoFetch(apiKey, `/smtp/templates/${templateId}`, { method: 'DELETE' })
}

// ==== トランザクショナルメール送信 ====
export function sendTransactionalEmail(apiKey, {
  to,
  subject,
  htmlContent,
  templateId,
  sender,
  scheduledAt,
  params,
  tags,
}) {
  const body = { to, sender }
  if (templateId) {
    body.templateId = templateId
  } else {
    if (subject) body.subject = subject
    if (htmlContent) body.htmlContent = htmlContent
  }
  if (scheduledAt) body.scheduledAt = scheduledAt
  if (params && Object.keys(params).length > 0) body.params = params
  if (tags && tags.length > 0) body.tags = tags

  return brevoFetch(apiKey, '/smtp/email', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ==== メールキャンペーン ====
export function listCampaigns(apiKey, { type = 'classic', status, limit = 25, offset = 0 } = {}) {
  const params = new URLSearchParams()
  params.set('type', type)
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  if (status) params.set('status', status)
  return brevoFetch(apiKey, `/emailCampaigns?${params.toString()}`)
}

export function getCampaign(apiKey, campaignId) {
  return brevoFetch(apiKey, `/emailCampaigns/${campaignId}`)
}

export function createCampaign(apiKey, {
  name,
  subject,
  sender,
  htmlContent,
  recipients,
  scheduledAt,
  replyTo,
  type = 'classic',
}) {
  const body = { name, subject, sender, htmlContent, recipients, type }
  if (scheduledAt) body.scheduledAt = scheduledAt
  if (replyTo) body.replyTo = replyTo
  return brevoFetch(apiKey, '/emailCampaigns', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateCampaign(apiKey, campaignId, updates) {
  return brevoFetch(apiKey, `/emailCampaigns/${campaignId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

export function deleteCampaign(apiKey, campaignId) {
  return brevoFetch(apiKey, `/emailCampaigns/${campaignId}`, { method: 'DELETE' })
}

export function sendCampaignNow(apiKey, campaignId) {
  return brevoFetch(apiKey, `/emailCampaigns/${campaignId}/sendNow`, {
    method: 'POST',
  })
}

// ==== 統計 ====
export function getAggregatedReport(apiKey, { startDate, endDate, days = 30 } = {}) {
  const params = new URLSearchParams()
  if (!endDate) {
    const now = new Date()
    endDate = now.toISOString().split('T')[0]
  }
  if (!startDate) {
    const start = new Date()
    start.setDate(start.getDate() - days)
    startDate = start.toISOString().split('T')[0]
  }
  params.set('startDate', startDate)
  params.set('endDate', endDate)
  return brevoFetch(apiKey, `/smtp/statistics/aggregatedReport?${params.toString()}`)
}

export function getEmailEvents(apiKey, { limit = 50, offset = 0, event, startDate, endDate } = {}) {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  if (event) params.set('event', event)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  return brevoFetch(apiKey, `/smtp/statistics/events?${params.toString()}`)
}

// ==== 属性（カスタムフィールド） ====
export function listAttributes(apiKey) {
  return brevoFetch(apiKey, '/contacts/attributes')
}
