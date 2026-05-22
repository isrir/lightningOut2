export default async function handler(req, res) {
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

    // Step 2: Try lightningoutsingleaccess with form-encoded body and camelCase siteUrl
    // The endpoint is form-encoded (like /token), not JSON
    const singleAccessRes = await fetch(
      `${instance_url}/services/oauth2/lightningoutsingleaccess`,
      {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${access_token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          siteUrl: "https://creationtechnology4.my.site.com/testlwr",
        }),
      }
    );

    const rawBody = await singleAccessRes.text();
    console.log("SingleAccess status:", singleAccessRes.status);
    console.log("SingleAccess body:", rawBody);

    if (!singleAccessRes.ok) {
      return res.status(502).json({
        error: "Failed to get LO2 frontdoor URL",
        status: singleAccessRes.status,
        detail: rawBody,
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return res.status(502).json({ error: "Unexpected response format", detail: rawBody });
    }

    // Response field may be frontdoor_uri or frontdoorUrl — log all keys
    console.log("SingleAccess response keys:", Object.keys(parsed));

    const frontdoorUrl = parsed.frontdoor_uri || parsed.frontdoorUrl || parsed.url;
    if (!frontdoorUrl) {
      return res.status(502).json({ error: "No frontdoor URL in response", detail: parsed });
    }

    return res.status(200).json({ frontdoorUrl });

  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: err.message });
  }
}