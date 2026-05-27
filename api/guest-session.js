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

    // Step 1: client_credentials grant
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
    console.log("✅ Token obtained, instance_url:", instance_url);

    // Step 2: try LO2 frontdoor endpoint first
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

    const rawText = await frontdoorResponse.text();
    console.log("Frontdoor raw response (first 300):", rawText.substring(0, 300));

    // Check if response is valid JSON with frontdoorUrl
    let frontdoorUrl;
    try {
      const frontdoorData = JSON.parse(rawText);
      if (frontdoorData.frontdoorUrl) {
        frontdoorUrl = frontdoorData.frontdoorUrl;
        console.log("✅ LO2 frontdoor URL obtained");
      }
    } catch (e) {
      console.log("LO2 frontdoor endpoint returned HTML — falling back to classic frontdoor");
    }

    // Step 3: fall back to classic /secur/frontdoor.jsp
    if (!frontdoorUrl) {
      const retURL = encodeURIComponent(
        `/lightning/n/LearningProgramForm`
      );
      frontdoorUrl = `${instance_url}/secur/frontdoor.jsp?sid=${access_token}&retURL=${retURL}`;
      console.log("✅ Classic frontdoor URL built");
    }

    return res.status(200).json({
      frontdoorUrl,
      instanceUrl: instance_url
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({ error: "Internal server error", message: error.message });
  }
}