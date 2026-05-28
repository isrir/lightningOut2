import crypto from "crypto";

export default async function handler(req, res) {
  // Set CORS headers for Vercel
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  // Only allow GET
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  try {
    // Get environment variables
    const domain = process.env.SF_DOMAIN;
    const clientId = process.env.SF_CLIENT_ID;
    const username = process.env.SF_NAMED_USER;
    let privateKey = process.env.SF_PRIVATE_KEY;
    
    // Handle private key formatting (Vercel sometimes strips newlines)
    if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, "\n");
    }

    // Validate required env vars
    const missing = [];
    if (!domain) missing.push("SF_DOMAIN");
    if (!clientId) missing.push("SF_CLIENT_ID");
    if (!username) missing.push("SF_NAMED_USER");
    if (!privateKey) missing.push("SF_PRIVATE_KEY");
    
    if (missing.length > 0) {
      console.error("Missing env vars:", missing);
      return res.status(500).json({ 
        error: "Configuration error", 
        missing,
        hint: "Check Vercel environment variables"
      });
    }

    // ── Step 1: Build JWT for OAuth ──────────────────────────────────────
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: clientId,
      sub: username,
      aud: "https://login.salesforce.com",
      exp: now + 300, // 5 minutes
    })).toString("base64url");

    // Sign the JWT
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(privateKey, "base64url");
    const jwt = `${header}.${payload}.${signature}`;

    // ── Step 2: Exchange JWT for access token ─────────────────────────────
    const tokenUrl = `https://${domain}/services/oauth2/token`;
    const tokenBody = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    });

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenBody.toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("JWT auth failed:", tokenData);
      return res.status(502).json({
        error: "JWT authentication failed",
        detail: tokenData.error_description || tokenData.error,
      });
    }

    const { access_token, instance_url } = tokenData;

    // ── Step 3: Try to get Lightning Out 2.0 frontdoor URL ────────────────
    let frontdoorUrl = null;

    try {
      const lo2Res = await fetch(`${instance_url}/services/lightning/ui/2.0/frontdoor`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const contentType = lo2Res.headers.get("content-type") || "";
      
      if (contentType.includes("application/json")) {
        const lo2Data = await lo2Res.json();
        if (lo2Data.frontdoorUrl) {
          frontdoorUrl = lo2Data.frontdoorUrl;
          console.log("✅ Using Lightning Out 2.0 frontdoor endpoint");
        }
      } else {
        console.log("⚠️ LO2 endpoint returned non-JSON, using fallback");
      }
    } catch (lo2Error) {
      console.warn("⚠️ LO2 frontdoor fetch failed:", lo2Error.message);
    }

    // ── Step 4: Fallback to classic frontdoor.jsp ─────────────────────────
    if (!frontdoorUrl) {
      // Update this to your actual component or app
      const retUrl = encodeURIComponent("/lightning/c/learning-program-form-app");
      frontdoorUrl = `${instance_url}/secur/frontdoor.jsp?sid=${access_token}&retURL=${retUrl}`;
      console.log("📝 Using classic frontdoor.jsp fallback");
    }

    // Success response
    return res.status(200).json({
      frontdoorUrl,
      instanceUrl: instance_url,
      method: frontdoorUrl.includes("frontdoor.jsp") ? "classic" : "lo2"
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}