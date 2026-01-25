# Architectural Decisions

## [INIT] Core Decisions from Planning
- Browser uploads: presigned URL방식
- Server uploads (CardDAV): S3Client.send(PutObjectCommand) 직접 호출
- CDN: Bunny CDN (Origin을 S3로 연결)
- Image transformation: 클라이언트 측에서 업로드 전 처리

## [2026-01-26] Task 15: S3 CORS Configuration

**Status**: Manual configuration required (no code changes)

**AWS Console Steps**:
1. Navigate to S3 bucket in AWS Console
2. Go to "Permissions" tab
3. Scroll to "Cross-origin resource sharing (CORS)"
4. Add CORS configuration:

```json
[
  {
    "AllowedHeaders": ["Content-Type"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": [
      "https://your-production-domain.com",
      "http://localhost:3000"
    ],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]
```

**Important**:
- Replace `your-production-domain.com` with actual production domain
- Add all development domains (localhost:3000, etc.)
- Only PUT method needed (presigned URL uploads)
- Content-Type header required for file uploads

**Verification**:
- Browser upload should work without CORS errors
- Check browser console for CORS-related errors
- Test from both production and development environments

**Note**: This is a one-time manual configuration. No code changes needed.
