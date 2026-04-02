/**
 * @module cors-proxy
 * @purpose Cloudflare Worker for RSS feed CORS proxying
 *
 * Endpoint: GET /?url=https://example.com/feed.xml
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Only allow GET
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

      // Clone response and add CORS headers
      const responseBody = await targetResponse.arrayBuffer();
      
      return new Response(responseBody, {
        status: targetResponse.status,
        statusText: targetResponse.statusText,
        headers: {
          "Content-Type": targetResponse.headers.get("Content-Type") || "application/xml",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
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
  },
};
