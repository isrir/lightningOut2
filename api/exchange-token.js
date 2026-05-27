// file: api/exchange-token.js

export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Get the authorization code and redirect URI from the request body
  const { code, redirectUri } = req.body;

  if (!code || !redirectUri) {
    return res.status(400).json({ error: 'Missing "code" or "redirectUri" in request body.' });
  }

  // 2. Get your Connected App credentials from environment variables
  const clientId = process.env.SF_CLIENT_ID;
  const clientSecret = process.env.SF_CLIENT_SECRET;
  const domain = process.env.SF_DOMAIN; // e.g., creationtechnology4.my.salesforce.com

  if (!clientId || !clientSecret || !domain) {
    console.error('Missing SF environment variables');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    // 3. Call Salesforce's token endpoint to exchange the code for a token
    const response = await fetch(`https://${domain}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier  // ← CRITICAL: Add this line
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Salesforce token error:', data);
      return res.status(response.status).json({ error: 'Failed to exchange code with Salesforce.', detail: data });
    }

    // 4. Return the necessary tokens to the frontend
    return res.status(200).json({
      accessToken: data.access_token,
      instanceUrl: data.instance_url,
      // Optional: You can also send back the refresh token and id token if needed
      // refreshToken: data.refresh_token,
    });

  } catch (error) {
    console.error('Internal server error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}