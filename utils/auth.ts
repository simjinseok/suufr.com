import { cookies } from 'next/headers';

export async function getSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    return null;
  }

  // JWT payload 디코딩 (header.payload.signature 중 payload 부분)
  const payload = JSON.parse(
    Buffer.from(accessToken.split('.')[1], 'base64').toString(),
  );

  return {
    user: {
      id: payload.sub,
    },
  };
}
