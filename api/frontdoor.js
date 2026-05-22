export default async function handler(req, res) {
  // Allow GitHub Pages to call this
  res.setHeader("Access-Control-Allow-Origin", "https://isrir.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const SF_DOMAIN     = process.env.SF_DOMAIN;
    const CLIENT_ID     = process.env.SF_CLIENT_ID;
    const CLIENT_SECRET = process.env.SF_CLIENT_SECRET;

    if (!SF_DOMAIN || !CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({ error: "Missing environment variables" });
    }

    // Step 1: Get access token via OAuth2 client credentials
    const tokenRes = await fetch(
      `https://${SF_DOMAIN}/services/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type:    "client_credentials",
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
        }),
      }
    );

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token error:", err);
      return res.status(502).json({ error: "Failed to get Salesforce token", detail: err });
    }

    const { access_token, instance_url } = await tokenRes.json();

    // Step 2: Exchange token for a frontdoor URL via UI Bridge API
    const bridgeRes = await fetch(
      `${instance_url}/services/oauth2/frontdoor-bridge`,
      {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          retURL: "/lightning/n/Home",
        }),
      }
    );

    if (!bridgeRes.ok) {
      const err = await bridgeRes.text();
      console.error("Bridge error:", err);
      return res.status(502).json({ error: "Failed to get frontdoor URL", detail: err });
    }

    const { frontdoor_uri } = await bridgeRes.json();

    return res.status(200).json({ frontdoorUrl: frontdoor_uri });

  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: err.message });
  }
}