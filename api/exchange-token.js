// api/exchange-token.js
// Exchange OAuth code for tokens (for user-authenticated flows)

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { code, redirectUri, codeVerifier } = req.body;
    
    if (!code || !redirectUri) {
      return res.status(400).json({ 
        error: "Missing required fields. Send { code, redirectUri }" 
      });
    }

    const domain = process.env.SF_DOMAIN;
    const clientId = process.env.SF_CLIENT_ID;
    const clientSecret = process.env.SF_CLIENT_SECRET;

    const response = await fetch(`https://${domain}/services/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        ...(codeVerifier && { code_verifier: codeVerifier })
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Salesforce token error:", data);
      return res.status(response.status).json({ 
        error: "Failed to exchange code with Salesforce",
        detail: data 
      });
    }

    return res.status(200).json({
      accessToken: data.access_token,
      instanceUrl: data.instance_url,
      refreshToken: data.refresh_token
    });

  } catch (error) {
    console.error("Exchange error:", error);
    return res.status(500).json({ error: error.message });
  }
}