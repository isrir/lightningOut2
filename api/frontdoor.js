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

    // Step 2: Use the Lightning Out 2.0 dedicated endpoint
    // /services/oauth2/lightningoutsingleaccess is purpose-built for LO2.
    // It returns a frontdoor URL whose origin is the LWR site (my.site.com),
    // not the org root (my.salesforce.com), so frame-ancestors CSP is respected.
    const singleAccessRes = await fetch(
      `${instance_url}/services/oauth2/lightningoutsingleaccess`,
      {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          site_url: "https://creationtechnology4.my.site.com/testlwr",
        }),
      }
    );

    if (!singleAccessRes.ok) {
      const err = await singleAccessRes.text();
      console.error("SingleAccess error:", err);
      return res.status(502).json({ error: "Failed to get LO2 frontdoor URL", detail: err });
    }

    const { frontdoor_uri } = await singleAccessRes.json();

    return res.status(200).json({ frontdoorUrl: frontdoor_uri });

  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: err.message });
  }
}