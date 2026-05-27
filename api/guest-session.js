// api/guest-session.js
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();

  // Log all environment variables (without exposing full secrets)
  console.log("=== Environment Check ===");
  console.log("SF_DOMAIN exists:", !!process.env.SF_DOMAIN);
  console.log("SF_CLIENT_ID exists:", !!process.env.SF_CLIENT_ID);
  console.log("SF_CLIENT_SECRET exists:", !!process.env.SF_CLIENT_SECRET);
  console.log("SF_GUEST_USERNAME exists:", !!process.env.SF_GUEST_USERNAME);
  console.log("SF_GUEST_PASSWORD exists:", !!process.env.SF_GUEST_PASSWORD);
  console.log("========================");

  try {
    // Validate environment variables
    const domain = process.env.SF_DOMAIN;
    const clientId = process.env.SF_CLIENT_ID;
    const clientSecret = process.env.SF_CLIENT_SECRET;
    const username = process.env.SF_GUEST_USERNAME;
    const password = process.env.SF_GUEST_PASSWORD;
    const securityToken = process.env.SF_SECURITY_TOKEN || "";
    console.log("Username:", username);
console.log("Password length:", password.length);
console.log("Security token length:", securityToken.length);
console.log("Combined password length:", (password + securityToken).length);
    const missingVars = [];
    if (!domain) missingVars.push("SF_DOMAIN");
    if (!clientId) missingVars.push("SF_CLIENT_ID");
    if (!clientSecret) missingVars.push("SF_CLIENT_SECRET");
    if (!username) missingVars.push("SF_GUEST_USERNAME");
    if (!password) missingVars.push("SF_GUEST_PASSWORD");

    if (missingVars.length > 0) {
      console.error("Missing environment variables:", missingVars);
      return res.status(500).json({ 
        error: "Server configuration error",
        missing: missingVars
      });
    }

    console.log("Attempting to authenticate with Salesforce...");
    
    // Step 1: Get OAuth token using password grant
    const tokenUrl = `https://${domain}/services/oauth2/token`;
    console.log("Token URL:", tokenUrl);
    
    const tokenBody = new URLSearchParams({
      grant_type: "password",
      client_id: clientId,
      client_secret: clientSecret,
      username: username,
      password: password + securityToken
    });

    console.log("Sending request to Salesforce...");
    
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenBody.toString()
    });

    console.log("Salesforce response status:", tokenResponse.status);
    
    const tokenData = await tokenResponse.json();
    console.log("Salesforce response body keys:", Object.keys(tokenData));
    
    if (tokenData.error) {
      console.error("Salesforce error:", tokenData.error);
      console.error("Error description:", tokenData.error_description);
    }

    if (!tokenResponse.ok) {
      let errorMessage = "Failed to authenticate with Salesforce";
      if (tokenData.error_description) {
        errorMessage += `: ${tokenData.error_description}`;
      } else if (tokenData.error) {
        errorMessage += `: ${tokenData.error}`;
      }
      
      console.error(errorMessage);
      return res.status(502).json({ 
        error: errorMessage,
        salesforce_error: tokenData.error,
        salesforce_description: tokenData.error_description
      });
    }

    const { access_token, instance_url } = tokenData;
    console.log("✅ Authentication successful");
    console.log("Instance URL:", instance_url);

    // Step 2: Get Lightning Out 2.0 frontdoor URL
    console.log("Getting frontdoor URL...");
    
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

    console.log("Frontdoor response status:", frontdoorResponse.status);
    
    const frontdoorData = await frontdoorResponse.json();
    console.log("Frontdoor response keys:", Object.keys(frontdoorData));

    if (!frontdoorResponse.ok) {
      console.error("Frontdoor error:", frontdoorData);
      return res.status(502).json({ 
        error: "Failed to get Lightning Out session",
        status: frontdoorResponse.status,
        detail: frontdoorData
      });
    }

    if (!frontdoorData.frontdoorUrl) {
      console.error("No frontdoorUrl in response:", frontdoorData);
      return res.status(502).json({ 
        error: "No frontdoorUrl in response",
        detail: frontdoorData
      });
    }

    console.log("✅ Frontdoor URL obtained successfully");
    console.log("Frontdoor URL preview:", frontdoorData.frontdoorUrl.substring(0, 100) + "...");
    
    return res.status(200).json({ 
      frontdoorUrl: frontdoorData.frontdoorUrl,
      instanceUrl: instance_url
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message,
      stack: error.stack
    });
  }
}