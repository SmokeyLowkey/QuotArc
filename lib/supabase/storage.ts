import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const BUCKET = 'chat-attachments'
const MAX_IMAGE_SIZE = 10 * 1024 * 1024  // 10MB
const MAX_PDF_SIZE = 25 * 1024 * 1024    // 25MB
const MAX_AUDIO_SIZE = 10 * 1024 * 1024  // 10MB (~5min voice note)

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
])

function getStorageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ).storage
}

// Ensure bucket allows all ALLOWED_TYPES (runs once)
let bucketSynced = false
async function ensureBucketMimeTypes() {
  if (bucketSynced) return
  bucketSynced = true
  try {
    const storage = getStorageClient()
    await storage.updateBucket(BUCKET, {
      public: false,
      allowedMimeTypes: [...ALLOWED_TYPES],
    })
  } catch {
    // Non-fatal — bucket may already be configured correctly
    bucketSynced = false
  }
}

export function validateFile(type: string, size: number): string | null {
  if (!ALLOWED_TYPES.has(type)) {
    return `File type ${type} is not allowed. Allowed: JPEG, PNG, WebP, HEIC, PDF.`
  }

  const isImage = type.startsWith('image/')
  const isAudio = type.startsWith('audio/')
  const maxSize = isImage ? MAX_IMAGE_SIZE : isAudio ? MAX_AUDIO_SIZE : MAX_PDF_SIZE

  if (size > maxSize) {
    const maxMB = maxSize / (1024 * 1024)
    const label = isImage ? 'images' : isAudio ? 'audio' : 'PDFs'
    return `File too large. Maximum ${maxMB}MB for ${label}.`
  }

  return null
}

const LOGO_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_LOGO_SIZE = 5 * 1024 * 1024  // 5MB

export async function uploadLogo(
  buffer: Buffer,
  userId: string,
  contentType: string
): Promise<{ url: string }> {
  if (!LOGO_ALLOWED_TYPES.has(contentType)) {
    throw new Error('Logo must be a JPEG, PNG, or WebP image.')
  }
  if (buffer.length > MAX_LOGO_SIZE) {
    throw new Error('Logo must be under 5MB.')
  }

  const storage = getStorageClient()
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
  const path = `logos/${userId}/logo.${ext}`

  const { error } = await storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true })

  if (error) {
    throw new Error(`Logo upload failed: ${error.message}`)
  }

  const { data: urlData } = storage.from(BUCKET).getPublicUrl(path)
  // Cache-bust since we upsert with the same filename
  return { url: `${urlData.publicUrl}?t=${Date.now()}` }
}

export async function uploadChatAttachment(
  quoteId: string,
  buffer: Buffer,
  originalName: string,
  contentType: string
): Promise<{ url: string; name: string; type: string; size: number }> {
  await ensureBucketMimeTypes()
  const storage = getStorageClient()
  const ext = originalName.split('.').pop()?.toLowerCase() || 'bin'
  const uniqueName = `${randomBytes(16).toString('hex')}.${ext}`
  const path = `${quoteId}/${uniqueName}`

  const { error } = await storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: false,
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  const { data: urlData } = storage.from(BUCKET).getPublicUrl(path)

  return {
    url: urlData.publicUrl,
    name: originalName,
    type: contentType,
    size: buffer.length,
  }
}
