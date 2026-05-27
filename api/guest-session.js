// api/guest-session.js
// This endpoint provides a session for guest users without requiring login

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Get credentials from environment variables
    const domain = process.env.SF_DOMAIN;
    const clientId = process.env.SF_CLIENT_ID;
    const clientSecret = process.env.SF_CLIENT_SECRET;
    const username = process.env.SF_GUEST_USERNAME;
    const password = process.env.SF_GUEST_PASSWORD;
    const securityToken = process.env.SF_SECURITY_TOKEN;

    if (!domain || !clientId || !clientSecret || !username || !password) {
      console.error("Missing environment variables");
      return res.status(500).json({ 
        error: "Server configuration error. Missing Salesforce credentials." 
      });
    }

    // Step 1: Get OAuth token using password grant (service account)
    console.log("Authenticating with Salesforce as guest user...");
    
    const tokenUrl = `https://${domain}/services/oauth2/token`;
    const tokenBody = new URLSearchParams({
      grant_type: "password",
      client_id: clientId,
      client_secret: clientSecret,
      username: username,
      password: password + (securityToken || "")
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenBody.toString()
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Token error:", tokenData);
      return res.status(502).json({ 
        error: "Failed to authenticate with Salesforce",
        detail: tokenData.error_description || tokenData.error
      });
    }

    const { access_token, instance_url } = tokenData;
    console.log("✅ Guest authentication successful");

    // Step 2: Get Lightning Out 2.0 frontdoor URL
    const frontdoorResponse = await fetch(
      `${instance_url}/services/lightning/ui/2.0/frontdoor`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({})
      }
    );

    const frontdoorData = await frontdoorResponse.json();

    if (!frontdoorResponse.ok) {
      console.error("Frontdoor error:", frontdoorData);
      return res.status(502).json({ 
        error: "Failed to get Lightning Out session",
        detail: frontdoorData
      });
    }

    if (!frontdoorData.frontdoorUrl) {
      return res.status(502).json({ 
        error: "No frontdoorUrl in response",
        detail: frontdoorData
      });
    }

    console.log("✅ Frontdoor URL obtained successfully");
    
    // Return the frontdoor URL to the client
    return res.status(200).json({ 
      frontdoorUrl: frontdoorData.frontdoorUrl,
      instanceUrl: instance_url
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message 
    });
  }
}