/**
 * @module cors-proxy
 * @purpose Cloudflare Worker for RSS feed CORS proxying and NVIDIA API
 *
 * Endpoints:
 * - GET /?url=https://example.com/feed.xml - RSS Proxy
 * - POST /api/nvidia - NVIDIA API Proxy
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight for all routes
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // NVIDIA API Proxy
    if (path === "/api/nvidia" && request.method === "POST") {
      return handleNvidiaProxy(request);
    }

    // RSS Feed Proxy (original)
    if (path === "/" && request.method === "GET") {
      return handleRssProxy(request);
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  },
};

/**
 * Handle NVIDIA API proxy requests
 */
async function handleNvidiaProxy(request) {
  try {
    const body = await request.json();
    
    // Forward to NVIDIA API
    const nvidiaResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": request.headers.get("Authorization") || "",
      },
      body: JSON.stringify(body),
    });

    // Clone response and add CORS headers
    const responseBody = await nvidiaResponse.arrayBuffer();
    
    return new Response(responseBody, {
      status: nvidiaResponse.status,
      statusText: nvidiaResponse.statusText,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to proxy NVIDIA API request",
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

/**
 * Handle RSS feed proxy requests
 */
async function handleRssProxy(request) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");

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

  // Validate URL scheme
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
        "User-Agent": "TrendRadar-RSS-Proxy/1.0 (News Aggregator)",
        "Accept": "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
      },
    });

    const responseBody = await targetResponse.arrayBuffer();
    
    return new Response(responseBody, {
      status: targetResponse.status,
      statusText: targetResponse.statusText,
      headers: {
        "Content-Type": targetResponse.headers.get("Content-Type") || "application/xml",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
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
