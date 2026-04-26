'use client';

import { useRef, useState } from 'react';
import { Trash2, ImagePlus, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  uploadLineItemPhoto,
  deletePhotoByUrl,
  ACCEPT_ATTR,
  isAcceptedFile,
} from '@/lib/utils/photo-upload';

interface LineItemPhotosProps {
  lineItemId: string;
  photos: string[];
  onChange: (next: string[]) => void;
  max?: number;
  disabled?: boolean;
}

export function LineItemPhotos({
  lineItemId,
  photos,
  onChange,
  max = 3,
  disabled = false,
}: LineItemPhotosProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const remaining = max - photos.length;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;

    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of toUpload) {
        if (!isAcceptedFile(file)) {
          setError(`Skipped "${file.name}" — only JPEG, PNG, WebP, or HEIC allowed.`);
          continue;
        }
        const url = await uploadLineItemPhoto(file, lineItemId, supabase);
        uploaded.push(url);
      }
      if (uploaded.length > 0) onChange([...photos, ...uploaded]);
    } catch (err) {
      console.error('Photo upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async (url: string) => {
    // Optimistic update
    onChange(photos.filter((p) => p !== url));
    try {
      await deletePhotoByUrl(url, supabase);
    } catch (err) {
      console.error('Photo delete failed:', err);
      // Don't restore — orphan in storage is harmless and can be reaped later
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        {photos.map((url) => (
          <div
            key={url}
            className="w-16 h-16 rounded overflow-hidden relative group border border-[var(--color-border)] bg-[var(--color-bg-light)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="w-full h-full object-cover" />
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(url)}
                aria-label="Remove photo"
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        ))}

        {!disabled && remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-16 h-16 rounded border border-dashed border-[var(--color-border)] bg-[var(--color-bg-light)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] flex flex-col items-center justify-center text-[10px] text-[var(--color-text-muted)] gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Add photo (up to ${max})`}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ImagePlus className="w-4 h-4" />
                <span>Add</span>
              </>
            )}
          </button>
        )}

        {photos.length > 0 && (
          <span className="text-[11px] text-[var(--color-text-muted)] ml-1">
            {photos.length} / {max}
          </span>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
