import { PrismaClient } from '@prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { S3Service } from '../apps/api/src/s3/s3.service';
import * as https from 'https';
import * as http from 'http';
import { randomUUID } from 'crypto';

const pool = new Pool({ connectionString: process.env.POSTGRES_PRISMA_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const s3Service = new S3Service();

interface MigrationStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
}

interface FailedMigration {
  table: string;
  id: number;
  url: string;
  error: string;
}

const failedMigrations: FailedMigration[] = [];

/**
 * Check if URL is a Cloudinary URL
 */
function isCloudinaryUrl(url: string | null): boolean {
  return url?.includes('res.cloudinary.com') ?? false;
}

/**
 * Download file from URL
 */
async function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Get content type from URL extension
 */
function getContentType(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Generate S3 key from Cloudinary URL
 */
function generateS3Key(cloudinaryUrl: string, folder: 'images' | 'media'): string {
  const ext = cloudinaryUrl.split('.').pop()?.split('?')[0] || 'jpg';
  const uuid = randomUUID();
  return `${folder}/${uuid}.${ext}`;
}

/**
 * Convert S3 URL to Bunny CDN URL
 */
function convertToBunnyCdnUrl(s3Url: string): string {
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
  if (!cdnUrl) {
    throw new Error('NEXT_PUBLIC_CDN_URL environment variable not set');
  }

  // Extract key from S3 URL
  const urlObj = new URL(s3Url);
  const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;

  return `${cdnUrl}/${key}`;
}

/**
 * Retry operation with exponential backoff
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  operationName: string = 'operation'
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      const delay = 1000 * Math.pow(2, i);
      console.log(`  ⚠️  ${operationName} failed, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Upload file to S3 and return Bunny CDN URL
 */
async function uploadToS3(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const s3Url = await s3Service.uploadFile(key, buffer, contentType);
  if (!s3Url) {
    throw new Error('S3 upload failed');
  }
  return convertToBunnyCdnUrl(s3Url);
}

/**
 * Migrate a single URL
 */
async function migrateUrl(
  url: string,
  folder: 'images' | 'media',
  isDryRun: boolean
): Promise<string> {
  if (!isCloudinaryUrl(url)) {
    throw new Error('Not a Cloudinary URL');
  }

  const s3Key = generateS3Key(url, folder);
  const contentType = getContentType(url);

  if (isDryRun) {
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
    return `${cdnUrl}/${s3Key}`;
  }

  // Download from Cloudinary
  const buffer = await retryOperation(
    () => downloadFile(url),
    3,
    'Download'
  );

  // Upload to S3
  const newUrl = await retryOperation(
    () => uploadToS3(buffer, s3Key, contentType),
    3,
    'Upload'
  );

  return newUrl;
}

/**
 * Log progress
 */
function logProgress(stats: MigrationStats, tableName: string) {
  console.log(`\n📊 ${tableName} Migration:`);
  console.log(`  Total: ${stats.total}`);
  console.log(`  ✅ Success: ${stats.success}`);
  console.log(`  ❌ Failed: ${stats.failed}`);
  console.log(`  ⏭️  Skipped: ${stats.skipped}`);
}

/**
 * Migrate Students table
 */
async function migrateStudents(isDryRun: boolean): Promise<void> {
  console.log('\n🔄 Migrating Students...');
  
  const students = await prisma.student.findMany({
    where: {
      profileImageUrl: {
        contains: 'res.cloudinary.com',
      },
    },
  });

  const stats: MigrationStats = {
    total: students.length,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  for (const student of students) {
    try {
      if (!student.profileImageUrl || !isCloudinaryUrl(student.profileImageUrl)) {
        stats.skipped++;
        continue;
      }

      const newUrl = await migrateUrl(student.profileImageUrl, 'images', isDryRun);

      if (isDryRun) {
        console.log(`  [DRY RUN] Student ${student.id}: ${student.profileImageUrl} → ${newUrl}`);
      } else {
        await prisma.student.update({
          where: { id: student.id },
          data: { profileImageUrl: newUrl },
        });
        console.log(`  ✅ Student ${student.id}: Migrated`);
      }

      stats.success++;
    } catch (error) {
      stats.failed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Student ${student.id}: ${errorMessage}`);
      failedMigrations.push({
        table: 'students',
        id: student.id,
        url: student.profileImageUrl || '',
        error: errorMessage,
      });
    }
  }

  logProgress(stats, 'Students');
}

/**
 * Migrate Organizations table
 */
async function migrateOrganizations(isDryRun: boolean): Promise<void> {
  console.log('\n🔄 Migrating Organizations...');
  
  const organizations = await prisma.organization.findMany({
    where: {
      OR: [
        { profileImageUrl: { contains: 'res.cloudinary.com' } },
        { logoImageUrl: { contains: 'res.cloudinary.com' } },
      ],
    },
  });

  const stats: MigrationStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  for (const org of organizations) {
    // Migrate profileImageUrl
    if (org.profileImageUrl && isCloudinaryUrl(org.profileImageUrl)) {
      stats.total++;
      try {
        const newUrl = await migrateUrl(org.profileImageUrl, 'images', isDryRun);

        if (isDryRun) {
          console.log(`  [DRY RUN] Org ${org.id} (profile): ${org.profileImageUrl} → ${newUrl}`);
        } else {
          await prisma.organization.update({
            where: { id: org.id },
            data: { profileImageUrl: newUrl },
          });
          console.log(`  ✅ Org ${org.id} (profile): Migrated`);
        }

        stats.success++;
      } catch (error) {
        stats.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Org ${org.id} (profile): ${errorMessage}`);
        failedMigrations.push({
          table: 'organizations',
          id: org.id,
          url: org.profileImageUrl,
          error: errorMessage,
        });
      }
    }

    // Migrate logoImageUrl
    if (org.logoImageUrl && isCloudinaryUrl(org.logoImageUrl)) {
      stats.total++;
      try {
        const newUrl = await migrateUrl(org.logoImageUrl, 'images', isDryRun);

        if (isDryRun) {
          console.log(`  [DRY RUN] Org ${org.id} (logo): ${org.logoImageUrl} → ${newUrl}`);
        } else {
          await prisma.organization.update({
            where: { id: org.id },
            data: { logoImageUrl: newUrl },
          });
          console.log(`  ✅ Org ${org.id} (logo): Migrated`);
        }

        stats.success++;
      } catch (error) {
        stats.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Org ${org.id} (logo): ${errorMessage}`);
        failedMigrations.push({
          table: 'organizations',
          id: org.id,
          url: org.logoImageUrl,
          error: errorMessage,
        });
      }
    }
  }

  logProgress(stats, 'Organizations');
}

/**
 * Migrate MediaFiles table
 */
async function migrateMediaFiles(isDryRun: boolean): Promise<void> {
  console.log('\n🔄 Migrating MediaFiles...');
  
  const mediaFiles = await prisma.mediaFile.findMany({
    where: {
      url: {
        contains: 'res.cloudinary.com',
      },
    },
  });

  const stats: MigrationStats = {
    total: mediaFiles.length,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  for (const mediaFile of mediaFiles) {
    try {
      if (!isCloudinaryUrl(mediaFile.url)) {
        stats.skipped++;
        continue;
      }

      const newUrl = await migrateUrl(mediaFile.url, 'media', isDryRun);

      if (isDryRun) {
        console.log(`  [DRY RUN] MediaFile ${mediaFile.id}: ${mediaFile.url} → ${newUrl}`);
      } else {
        // Extract new publicId from URL (the S3 key)
        const urlObj = new URL(newUrl);
        const newPublicId = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;

        await prisma.mediaFile.update({
          where: { id: mediaFile.id },
          data: {
            url: newUrl,
            publicId: newPublicId,
          },
        });
        console.log(`  ✅ MediaFile ${mediaFile.id}: Migrated`);
      }

      stats.success++;
    } catch (error) {
      stats.failed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ MediaFile ${mediaFile.id}: ${errorMessage}`);
      failedMigrations.push({
        table: 'media_files',
        id: mediaFile.id,
        url: mediaFile.url,
        error: errorMessage,
      });
    }
  }

  logProgress(stats, 'MediaFiles');
}

/**
 * Main migration function
 */
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  
  console.log('🚀 Starting Cloudinary to S3 Migration');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no changes will be made)' : '⚡ LIVE (changes will be applied)'}`);
  console.log(`CDN URL: ${process.env.NEXT_PUBLIC_CDN_URL || 'NOT SET'}`);
  
  if (!process.env.NEXT_PUBLIC_CDN_URL) {
    throw new Error('NEXT_PUBLIC_CDN_URL environment variable is required');
  }

  if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME) {
    throw new Error('AWS credentials and S3_BUCKET_NAME environment variables are required');
  }

  const startTime = Date.now();

  // Migrate each table
  await migrateStudents(isDryRun);
  await migrateOrganizations(isDryRun);
  await migrateMediaFiles(isDryRun);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Migration Complete');
  console.log(`Duration: ${duration}s`);

  if (failedMigrations.length > 0) {
    console.log('\n❌ Failed Migrations:');
    failedMigrations.forEach((failed) => {
      console.log(`  ${failed.table} #${failed.id}: ${failed.error}`);
      console.log(`    URL: ${failed.url}`);
    });
    console.log(`\nTotal failures: ${failedMigrations.length}`);
  } else {
    console.log('\n🎉 All migrations successful!');
  }

  if (isDryRun) {
    console.log('\n💡 This was a dry run. Run without --dry-run to apply changes.');
  }
}

// Run migration
main()
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
