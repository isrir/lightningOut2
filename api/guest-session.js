import crypto from "crypto";

export default async function handler(req, res) {
  // Tighten CORS in production — replace * with your actual frontend origin
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  try {
    const domain     = process.env.SF_DOMAIN;
    const clientId   = process.env.SF_CLIENT_ID;
    const username   = process.env.SF_NAMED_USER;
    const privateKey = process.env.SF_PRIVATE_KEY?.replace(/\\n/g, "\n");

    const missing = [];
    if (!domain)     missing.push("SF_DOMAIN");
    if (!clientId)   missing.push("SF_CLIENT_ID");
    if (!username)   missing.push("SF_NAMED_USER");
    if (!privateKey) missing.push("SF_PRIVATE_KEY");
    if (missing.length > 0) {
      return res.status(500).json({ error: "Missing env vars", missing });
    }

    // ── Step 1: Build & sign JWT ──────────────────────────────────────────
    const now      = Math.floor(Date.now() / 1000);
    const header   = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
    const payload  = Buffer.from(JSON.stringify({
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

    // ── Step 2: Exchange JWT for access token ─────────────────────────────
    const tokenRes  = await fetch(`https://${domain}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion:  jwt,
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("JWT auth failed:", tokenData);
      return res.status(502).json({
        error:  "JWT auth failed",
        detail: tokenData.error_description ?? tokenData.error,
      });
    }

    const { access_token, instance_url } = tokenData;

    // ── Step 3: Try Lightning Out 2.0 frontdoor first ─────────────────────
    // NOTE: As of 2025 this endpoint is not GA — it returns HTML for most orgs.
    // The try/catch below handles that gracefully.
    let frontdoorUrl = null;

    try {
      const fdRes = await fetch(
        `${instance_url}/services/lightning/ui/2.0/frontdoor`,
        {
          method:  "POST",
          headers: {
            "Authorization": `Bearer ${access_token}`,
            "Content-Type":  "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      // Salesforce returns HTML when the endpoint isn't available
      const contentType = fdRes.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const fdData = await fdRes.json();
        if (fdData.frontdoorUrl) {
          frontdoorUrl = fdData.frontdoorUrl;
          console.log("✅ Used Lightning Out 2.0 frontdoor");
        }
      } else {
        console.log("LO2 endpoint returned non-JSON — skipping");
      }
    } catch (fdError) {
      console.warn("LO2 frontdoor fetch failed:", fdError.message);
    }

    // ── Step 4: Fallback to classic frontdoor.jsp ─────────────────────────
    // ⚠️  frontdoor.jsp tokens are short-lived (~2 min). This is fine for
    //     immediately redirecting a browser, but don't cache this URL.
    if (!frontdoorUrl) {
      const retUrl   = encodeURIComponent("/lightning/n/LearningProgramForm");
      frontdoorUrl   = `${instance_url}/secur/frontdoor.jsp?sid=${access_token}&retURL=${retUrl}`;
      console.log("Using classic frontdoor.jsp fallback");
    }

    // ── Never log the full frontdoorUrl — it contains the session token ───
    console.log("✅ Returning frontdoorUrl for instance:", instance_url);
    return res.status(200).json({ frontdoorUrl, instanceUrl: instance_url });

  } catch (error) {
    console.error("Unexpected error:", error.message);
    return res.status(500).json({
      error:   "Internal server error",
      message: error.message,
    });
  }
}