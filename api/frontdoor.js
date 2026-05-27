export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { accessToken, instanceUrl } = req.body;

    if (!accessToken || !instanceUrl) {
      return res.status(400).json({
        error: "Missing required fields. Send { accessToken, instanceUrl }",
      });
    }

    let frontdoorUrl = null;

    // ── Try LO2 endpoint ──────────────────────────────────────────────────
    try {
      const response = await fetch(
        `${instanceUrl}/services/lightning/ui/2.0/frontdoor`,
        {
          method:  "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type":  "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (data.frontdoorUrl) frontdoorUrl = data.frontdoorUrl;
      }
    } catch (e) {
      console.warn("LO2 attempt failed:", e.message);
    }

    // ── Fallback to classic frontdoor.jsp ─────────────────────────────────
    if (!frontdoorUrl) {
      const retUrl = encodeURIComponent("/lightning/n/LearningProgramForm");
      frontdoorUrl = `${instanceUrl}/secur/frontdoor.jsp?sid=${accessToken}&retURL=${retUrl}`;
    }

    return res.status(200).json({ frontdoorUrl });

  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({ error: error.message });
  }
}