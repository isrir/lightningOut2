export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const domain       = process.env.SF_DOMAIN;
    const clientId     = process.env.SF_CLIENT_ID;
    const clientSecret = process.env.SF_CLIENT_SECRET;

    const missingVars = [];
    if (!domain)       missingVars.push("SF_DOMAIN");
    if (!clientId)     missingVars.push("SF_CLIENT_ID");
    if (!clientSecret) missingVars.push("SF_CLIENT_SECRET");
    if (missingVars.length > 0) {
      return res.status(500).json({ error: "Server configuration error", missing: missingVars });
    }

    // Step 1: client_credentials grant (no username/password needed)
    const tokenResponse = await fetch(
      `https://${domain}/services/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type:    "client_credentials",
          client_id:     clientId,
          client_secret: clientSecret,
        }).toString()
      }
    );
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      return res.status(502).json({
        error: "Failed to authenticate with Salesforce",
        salesforce_error: tokenData.error,
        salesforce_description: tokenData.error_description
      });
    }

    const { access_token, instance_url } = tokenData;

    // Step 2: exchange for LO2 frontdoor URL
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
    if (!frontdoorResponse.ok || !frontdoorData.frontdoorUrl) {
      return res.status(502).json({
        error: "Failed to get Lightning Out session",
        detail: frontdoorData
      });
    }

    return res.status(200).json({
      frontdoorUrl: frontdoorData.frontdoorUrl,
      instanceUrl:  instance_url
    });

  } catch (error) {
    return res.status(500).json({ error: "Internal server error", message: error.message });
  }
}