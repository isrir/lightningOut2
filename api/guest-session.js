import crypto from "crypto";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const domain     = process.env.SF_DOMAIN;
    const clientId   = process.env.SF_CLIENT_ID;
    const username   = process.env.SF_NAMED_USER;
    const privateKey = process.env.SF_PRIVATE_KEY.replace(/\\n/g, "\n");

    // Validate
    const missing = [];
    if (!domain)     missing.push("SF_DOMAIN");
    if (!clientId)   missing.push("SF_CLIENT_ID");
    if (!username)   missing.push("SF_NAMED_USER");
    if (!privateKey) missing.push("SF_PRIVATE_KEY");
    if (missing.length > 0) {
      return res.status(500).json({ error: "Missing env vars", missing });
    }

    // Build and sign JWT
    const now     = Math.floor(Date.now() / 1000);
    const header  = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: clientId,
      sub: username,
      aud: "https://login.salesforce.com",
      exp: now + 300,
    })).toString("base64url");

    const signature = crypto
      .createSign("RSA-SHA256")
      .update(`${header}.${payload}`)
      .sign(privateKey, "base64url");

    const jwt = `${header}.${payload}.${signature}`;

    console.log("Exchanging JWT for access token...");

    // Step 1: JWT Bearer → named-user access token
    const tokenRes  = await fetch(`https://${domain}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion:  jwt,
      }).toString(),
    });

    const tokenData = await tokenRes.json();
    console.log("Token response:", tokenRes.status, tokenData.error ?? "ok");

    if (!tokenRes.ok) {
      return res.status(502).json({
        error:  "JWT auth failed",
        detail: tokenData.error_description ?? tokenData.error,
      });
    }

    const { access_token, instance_url } = tokenData;
    console.log("✅ Token obtained, instance:", instance_url);

    // Step 2: exchange token for LO2 frontdoor URL
    const fdRes  = await fetch(`${instance_url}/services/lightning/ui/2.0/frontdoor`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({}),
    });

    const rawText = await fdRes.text();
    console.log("Frontdoor raw (first 200):", rawText.substring(0, 200));

    let frontdoorUrl;
    try {
      const fdData = JSON.parse(rawText);
      frontdoorUrl = fdData.frontdoorUrl;
    } catch {
      console.log("LO2 frontdoor returned HTML — falling back to classic frontdoor");
    }

    // Fallback: classic frontdoor.jsp
    if (!frontdoorUrl) {
      frontdoorUrl = `${instance_url}/secur/frontdoor.jsp?sid=${access_token}&retURL=/lightning/n/LearningProgramForm`;
      console.log("Using classic frontdoor fallback");
    }

    console.log("✅ Returning frontdoorUrl");
    return res.status(200).json({ frontdoorUrl, instanceUrl: instance_url });

  } catch (error) {
    console.error("Unexpected error:", error.message);
    return res.status(500).json({ error: "Internal server error", message: error.message });
  }
}