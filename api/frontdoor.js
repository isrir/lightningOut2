export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://isrir.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const SF_DOMAIN     = process.env.SF_DOMAIN;
    const SF_SITE       = process.env.SF_SITE;   // e.g. creationtechnology4.my.site.com/testlwr
    const CLIENT_ID     = process.env.SF_CLIENT_ID;
    const CLIENT_SECRET = process.env.SF_CLIENT_SECRET;

    if (!SF_DOMAIN || !SF_SITE || !CLIENT_ID || !CLIENT_SECRET) {
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

    const { access_token } = await tokenRes.json();

    // Step 2: Build frontdoor URL using the SITE domain as origin.
    // LO2 source (#z) extracts origin from this URL and uses it for ALL
    // subsequent iframe loads — so it must be the site domain (my.site.com),
    // NOT the org domain (my.salesforce.com), to avoid frame-ancestors:none.
    //
    // The LWR site handles frontdoor auth at /testlwr/secur/frontdoor.jsp
    const siteOrigin = `https://${SF_SITE.split("/")[0]}`;
    const sitePath   = "/" + SF_SITE.split("/").slice(1).join("/");
    const frontdoorUrl =
      `${siteOrigin}${sitePath}/secur/frontdoor.jsp?sid=${access_token}`;

    return res.status(200).json({ frontdoorUrl });

  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: err.message });
  }
}