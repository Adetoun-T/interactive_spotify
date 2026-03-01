import { redirect } from '@sveltejs/kit';
import { CLIENT_ID, CLIENT_SECRET } from '$env/static/private';

// Match this EXACTLY to your Spotify Dashboard
const REDIRECT_URI = 'http://127.0.0.1:5173/auth/callback';

export async function GET({ url }) {
  const code = url.searchParams.get('code');

  // PHASE 1: No code present? Send user to Spotify
  if (!code) {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: 'user-read-playback-state user-modify-playback-state user-top-read',
      show_dialog: 'true' // Forces the login/perm screen for testing
    });

    // We MUST throw the redirect to stop the rest of this function from running
    throw redirect(302, `https://accounts.spotify.com/authorize?${params.toString()}`);
  }

  // PHASE 2: Code returned? Exchange it for a Token
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
    })
  });

  const data = await res.json();

  if (!data.access_token) {
    return new Response('Auth failed: ' + JSON.stringify(data), { status: 400 });
  }

  // PHASE 3: Success! Send the token back to your gesture app
  throw redirect(302, `/?token=${data.access_token}`);
}