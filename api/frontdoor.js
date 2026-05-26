export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    // Frontend must send the OAuth token (obtained via user login)
    const { accessToken, instanceUrl } = req.body;
    
    if (!accessToken || !instanceUrl) {
      return res.status(400).json({ 
        error: "Missing required fields. Send { accessToken, instanceUrl }" 
      });
    }

    // Call the correct LO2 API endpoint
    const response = await fetch(
      `${instanceUrl}/services/lightning/ui/2.0/frontdoor`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Optional: specify which app or component to load
          // appId: "1UsdN00000025rdSAA"
        })
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Salesforce API error:", response.status, data);
      return res.status(502).json({ 
        error: "Lightning Out 2.0 API failed", 
        status: response.status,
        detail: data 
      });
    }

    if (!data.frontdoorUrl) {
      return res.status(502).json({ 
        error: "No frontdoorUrl in response", 
        detail: data 
      });
    }

    return res.status(200).json({ frontdoorUrl: data.frontdoorUrl });

  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({ error: error.message });
  }
}