import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /webhook/google/calendar
 * Proxy endpoint for Google Calendar webhook notifications
 * Google calls this URL when calendar events change
 */
export async function POST(request: NextRequest) {
  // Extract Google-specific headers
  const channelId = request.headers.get('x-goog-channel-id');
  const resourceState = request.headers.get('x-goog-resource-state');
  const resourceId = request.headers.get('x-goog-resource-id');

  console.log('[Google Webhook] Received notification:', {
    channelId,
    resourceState,
    resourceId,
  });

  if (!channelId || !resourceState) {
    console.log('[Google Webhook] Missing required headers');
    return NextResponse.json({ success: false }, { status: 400 });
  }

  try {
    // Forward to API server
    const response = await fetch(`${process.env.API_URL}/api/google/webhook/calendar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channelId, resourceState }),
    });

    if (!response.ok) {
      console.error('[Google Webhook] API error:', response.status);
    }
  }
  catch (err) {
    console.error('[Google Webhook] Error forwarding to API:', err);
  }

  // Always return 200 to acknowledge receipt to Google
  return NextResponse.json({ success: true }, { status: 200 });
}
