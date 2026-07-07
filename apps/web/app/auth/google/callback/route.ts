import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/utils/api-client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const redirectUrl = `${baseUrl}/settings/integrations`;

  if (error) {
    console.log('[Google Callback] Redirecting with error:', error);
    return NextResponse.redirect(`${redirectUrl}?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    console.log('[Google Callback] Missing params');
    return NextResponse.redirect(`${redirectUrl}?error=missing_params`);
  }

  try {
    console.log('[Google Callback] Calling exchange-code API...');
    const result = await apiClient<{ success: boolean; message?: string }>(
      '/api/google/exchange-code',
      { method: 'POST', body: { code, state } }
    );
    console.log('[Google Callback] API result:', result);

    if (result.success) {
      console.log('[Google Callback] Success! Redirecting...');
      return NextResponse.redirect(`${redirectUrl}?success=true`);
    } else {
      console.log('[Google Callback] API returned failure:', result.message);
      return NextResponse.redirect(`${redirectUrl}?error=${encodeURIComponent(result.message || 'auth_failed')}`);
    }
  } catch (err) {
    console.error('[Google Callback] Error:', err);
    const message = err instanceof Error ? err.message : 'auth_failed';
    return NextResponse.redirect(`${redirectUrl}?error=${encodeURIComponent(message)}`);
  }
}
