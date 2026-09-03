/**
 * @file imageCompression.ts
 * @description Client-side WebP image compression and optimization utility for KovertKlaus
 * After-Action Report (AAR) gift photos and avatar uploads.
 *
 * Provides high-efficiency client-side downscaling and WebP conversion via HTML5 Canvas,
 * reducing multi-megabyte mobile phone photos (3-10MB) to lightweight WebP snapshots (~50-150KB)
 * prior to transmission or database storage.
 */

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0 (default: 0.82)
  targetMimeType?: 'image/webp' | 'image/jpeg' | 'image/png';
  maxInputSizeBytes?: number; // default: 15MB
}

export interface CompressedImageResult {
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  compressionRatioPercent: number;
  width: number;
  height: number;
  mimeType: string;
}

const DEFAULT_MAX_WIDTH = 1200;
const DEFAULT_MAX_HEIGHT = 1200;
const DEFAULT_QUALITY = 0.82;
const DEFAULT_MAX_INPUT_SIZE = 15 * 1024 * 1024; // 15MB max file input

/**
 * Calculates downscaled dimensions preserving original aspect ratio.
 * Pure function - runs universally in Node and Browser environments.
 *
 * @param srcWidth - Source image width in pixels
 * @param srcHeight - Source image height in pixels
 * @param maxWidth - Maximum bounding box width
 * @param maxHeight - Maximum bounding box height
 * @returns Scaled { width, height }
 */
export function calculateAspectFitDimensions(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number = DEFAULT_MAX_WIDTH,
  maxHeight: number = DEFAULT_MAX_HEIGHT
): { width: number; height: number } {
  if (srcWidth <= 0 || srcHeight <= 0) {
    return { width: Math.max(1, maxWidth), height: Math.max(1, maxHeight) };
  }

  if (srcWidth <= maxWidth && srcHeight <= maxHeight) {
    return { width: Math.round(srcWidth), height: Math.round(srcHeight) };
  }

  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
  return {
    width: Math.max(1, Math.round(srcWidth * ratio)),
    height: Math.max(1, Math.round(srcHeight * ratio)),
  };
}

/**
 * Formats a raw byte count into a human-readable string (e.g. "84.2 KB", "1.4 MB").
 *
 * @param bytes - Size in bytes
 * @returns Human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Validates whether a given File object is an acceptable image within size limits.
 *
 * @param file - The browser File object to check
 * @param maxSizeBytes - Maximum allowed uncompressed input size
 * @returns Validation result object
 */
export function validateImageFile(
  file: File,
  maxSizeBytes: number = DEFAULT_MAX_INPUT_SIZE
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
  const isTypeValid = validTypes.includes(file.type.toLowerCase()) || file.type.startsWith('image/');

  if (!isTypeValid) {
    return {
      valid: false,
      error: `Unsupported file type (${file.type || 'unknown'}). Please upload a JPEG, PNG, or WebP photo.`,
    };
  }

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `Photo exceeds maximum allowed size of ${formatFileSize(maxSizeBytes)} (Selected file is ${formatFileSize(file.size)}).`,
    };
  }

  return { valid: true };
}

/**
 * Checks if a string is a base64 Data URL.
 */
export function isDataUrl(str: string): boolean {
  return typeof str === 'string' && /^data:image\/[a-zA-Z0-9+.-]+;base64,/i.test(str.trim());
}

/**
 * Compresses an image file in the browser using HTML5 Canvas and WebP encoding.
 * Downscales dimensions if exceeding maxWidth/maxHeight, converts to WebP with target quality.
 *
 * @param file - The input File object from a file picker or drop event
 * @param options - Configuration options for dimension caps and quality
 * @returns Promise resolving with compressed dataUrl and metrics
 */
export async function compressImageToWebP(
  file: File,
  options?: ImageCompressionOptions
): Promise<CompressedImageResult> {
  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxHeight = options?.maxHeight ?? DEFAULT_MAX_HEIGHT;
  const quality = options?.quality ?? DEFAULT_QUALITY;
  const targetMime = options?.targetMimeType ?? 'image/webp';
  const maxInputSize = options?.maxInputSizeBytes ?? DEFAULT_MAX_INPUT_SIZE;

  // 1. Validate Input File
  const validation = validateImageFile(file, maxInputSize);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file');
  }

  // 2. Load File into Image Bitmap or HTMLImageElement
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read image file from disk'));
    };

    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        reject(new Error('Image file data is empty'));
        return;
      }

      const img = new Image();

      img.onerror = () => {
        reject(new Error('Failed to decode image data into graphic canvas'));
      };

      img.onload = () => {
        try {
          const { width, height } = calculateAspectFitDimensions(
            img.naturalWidth || img.width,
            img.naturalHeight || img.height,
            maxWidth,
            maxHeight
          );

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 2D context unavailable'));
            return;
          }

          // Render with smooth bilinear interpolation
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Export as WebP
          let dataUrl = canvas.toDataURL(targetMime, quality);

          // If browser fails to support WebP export and falls back to PNG, fallback to JPEG
          if (targetMime === 'image/webp' && !dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          // Calculate approximate byte size from base64 string
          const base64Length = dataUrl.split(',')[1]?.length || 0;
          const compressedSize = Math.round((base64Length * 3) / 4);
          const originalSize = file.size;
          const compressionRatioPercent = originalSize > 0
            ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
            : 0;

          const effectiveMime = dataUrl.split(';')[0]?.replace('data:', '') || targetMime;

          resolve({
            dataUrl,
            originalSize,
            compressedSize,
            compressionRatioPercent,
            width,
            height,
            mimeType: effectiveMime,
          });
        } catch (canvasErr) {
          reject(new Error(`Canvas compression error: ${canvasErr instanceof Error ? canvasErr.message : 'unknown'}`));
        }
      };

      img.src = src;
    };

    reader.readAsDataURL(file);
  });
}
