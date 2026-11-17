import { supabase } from './supabase';

export const MEDIA_STORAGE_BUCKET = 'temp-media';
export const MEDIA_UPLOAD_STATUS_EVENT = 'bluefox_media_upload_status';

export interface MediaUploadResult {
  bucket_name: string;
  file_path: string;
  size: number;
  uploaded_at: string;
}

export interface MediaUploadRecord {
  attachmentId: string;
  status: 'uploading' | 'uploaded' | 'error';
  bucket_name: string;
  file_path?: string;
  error?: string;
  size?: number;
  promise?: Promise<MediaUploadResult>;
}

const uploadRegistry = new Map<string, MediaUploadRecord>();

function emitUploadStatus(record: MediaUploadRecord): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(MEDIA_UPLOAD_STATUS_EVENT, {
      detail: {
        attachmentId: record.attachmentId,
        status: record.status,
        bucket_name: record.bucket_name,
        file_path: record.file_path,
        error: record.error,
        size: record.size,
      },
    })
  );
}

async function performBucketUpload(
  attachmentId: string,
  zipBlob: Blob,
  bucketName: string
): Promise<MediaUploadResult> {
  const filePath = `uploads/media_${Date.now()}.zip`;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, zipBlob, {
      contentType: 'application/zip',
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    const detailedMessage =
      error.message || `Gagal mengunggah arsip ZIP ke bucket Supabase "${bucketName}".`;
    const errRecord: MediaUploadRecord = {
      attachmentId,
      status: 'error',
      bucket_name: bucketName,
      error: detailedMessage,
      size: zipBlob.size,
    };
    uploadRegistry.set(attachmentId, errRecord);
    emitUploadStatus(errRecord);
    throw new Error(detailedMessage);
  }

  const resolvedPath = data?.path || filePath;
  const result: MediaUploadResult = {
    bucket_name: bucketName,
    file_path: resolvedPath,
    size: zipBlob.size,
    uploaded_at: new Date().toISOString(),
  };

  const doneRecord: MediaUploadRecord = {
    attachmentId,
    status: 'uploaded',
    bucket_name: bucketName,
    file_path: resolvedPath,
    size: zipBlob.size,
  };
  uploadRegistry.set(attachmentId, doneRecord);
  emitUploadStatus(doneRecord);

  return result;
}

export function startMediaZipUpload(
  attachmentId: string,
  zipBlob: Blob,
  bucketName: string = MEDIA_STORAGE_BUCKET
): Promise<MediaUploadResult> {
  const existing = uploadRegistry.get(attachmentId);
  if (existing?.status === 'uploaded' && existing.file_path) {
    return Promise.resolve({
      bucket_name: existing.bucket_name,
      file_path: existing.file_path,
      size: existing.size || zipBlob.size,
      uploaded_at: new Date().toISOString(),
    });
  }
  if (existing?.status === 'uploading' && existing.promise) {
    return existing.promise;
  }

  const pendingRecord: MediaUploadRecord = {
    attachmentId,
    status: 'uploading',
    bucket_name: bucketName,
    size: zipBlob.size,
  };

  const uploadPromise = performBucketUpload(attachmentId, zipBlob, bucketName);
  pendingRecord.promise = uploadPromise;
  uploadRegistry.set(attachmentId, pendingRecord);
  emitUploadStatus(pendingRecord);

  return uploadPromise;
}

export function getMediaZipUploadState(attachmentId?: string): MediaUploadRecord | null {
  if (!attachmentId) return null;
  return uploadRegistry.get(attachmentId) || null;
}

export async function waitForMediaZipUpload(
  attachmentId?: string,
  fallbackZipBlob?: Blob,
  bucketName: string = MEDIA_STORAGE_BUCKET
): Promise<MediaUploadResult> {
  if (attachmentId) {
    const existing = uploadRegistry.get(attachmentId);
    if (existing?.status === 'uploaded' && existing.file_path) {
      return {
        bucket_name: existing.bucket_name,
        file_path: existing.file_path,
        size: existing.size || fallbackZipBlob?.size || 0,
        uploaded_at: new Date().toISOString(),
      };
    }

    if (existing?.status === 'uploading' && existing.promise) {
      return await existing.promise;
    }
  }

  if (fallbackZipBlob) {
    const retryId = attachmentId || `media-retry-${Date.now()}`;
    return await startMediaZipUpload(retryId, fallbackZipBlob, bucketName);
  }

  throw new Error(
    `File ZIP media belum tersedia atau gagal diunggah ke bucket "${bucketName}". Silakan unggah ulang berkas Anda.`
  );
}

export function clearMediaZipUploadRecord(attachmentId?: string): void {
  if (!attachmentId) return;
  uploadRegistry.delete(attachmentId);
}
