/**
 * @module cors-proxy
 * @purpose Cloudflare Worker for RSS feed CORS proxying
 *
 * Endpoint: GET /?url=https://example.com/feed.xml
 */

/**
 * Handle incoming requests
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleRequest(request) {
  // Only allow GET requests
  if (request.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  // Parse URL parameter
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");

  // Validate URL parameter exists
  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: "Missing 'url' parameter" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  // Validate URL scheme (only http/https allowed)
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    return new Response(
      JSON.stringify({ error: "Invalid URL scheme. Only http:// and https:// allowed" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  // Fetch from target URL
  try {
    const targetResponse = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "TrendRadar-RSS-Proxy/1.0",
      },
    });

    // Clone response and add CORS headers
    const modifiedHeaders = new Headers(targetResponse.headers);
    modifiedHeaders.set("Access-Control-Allow-Origin", "*");
    modifiedHeaders.set("Access-Control-Allow-Methods", "GET");

    return new Response(targetResponse.body, {
      status: targetResponse.status,
      statusText: targetResponse.statusText,
      headers: modifiedHeaders,
    });
  } catch (error) {
    // Return 502 for fetch errors
    return new Response(
      JSON.stringify({
        error: "Failed to fetch target URL",
        details: error.message,
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

// Main export for Cloudflare Worker
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  },
};
