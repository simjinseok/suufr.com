// 캐시 저장소 (TTL 5분)
interface CacheEntry {
  base64: string;
  mediaType: string;
  expiresAt: number;
}

const imageCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_IMAGE_SIZE = 500 * 1024; // 500KB 제한

/**
 * 동시 실행 제한 유틸리티
 * p-limit 패키지와 유사한 기능을 네이티브로 구현
 */
export function pLimit(concurrency: number) {
  const queue: (() => void)[] = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      queue.shift()!();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      const run = async () => {
        activeCount++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          next();
        }
      };

      if (activeCount < concurrency) {
        run();
      } else {
        queue.push(run);
      }
    });
  };
}

/**
 * Optimize Cloudinary URL with transformation for smaller images
 * Converts: https://res.cloudinary.com/.../upload/v123/image.jpg
 * To: https://res.cloudinary.com/.../upload/w_200,h_200,c_fill/v123/image.jpg
 */
export function optimizeCloudinaryUrl(url: string, size = 200): string {
  if (!url.includes('cloudinary.com')) return url;
  return url.replace('/upload/', `/upload/w_${size},h_${size},c_fill/`);
}

/**
 * Fetch an image from URL and convert to base64
 * Used for embedding profile images in vCards
 * Includes in-memory caching with 5 minute TTL
 */
export async function fetchImageAsBase64(
  url: string,
  timeoutMs = 5000,
): Promise<{ base64: string; mediaType: string } | null> {
  // Cloudinary URL만 허용 (SSRF 방지)
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.endsWith('cloudinary.com')) {
      return null;
    }
  } catch {
    return null;
  }

  // 캐시 확인
  const cached = imageCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return { base64: cached.base64, mediaType: cached.mediaType };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    // Content-Length 사전 검증
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    if (contentLength > MAX_IMAGE_SIZE) {
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    // 실제 크기 검증 (Content-Length 헤더가 없거나 부정확한 경우)
    if (buffer.byteLength > MAX_IMAGE_SIZE) {
      return null;
    }
    const base64 = Buffer.from(buffer).toString('base64');

    // 캐시 저장
    imageCache.set(url, {
      base64,
      mediaType: contentType,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return { base64, mediaType: contentType };
  }
  catch {
    return null;
  }
}
