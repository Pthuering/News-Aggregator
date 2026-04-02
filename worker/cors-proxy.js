/**
 * @module cors-proxy
 * @purpose Cloudflare Worker for RSS feed CORS proxying
 *
 * @deployedOn Cloudflare Workers
 *
 * @dataflow Client RSS URL → Worker → Target Feed → CORS Headers → Client
 *
 * @usage
 *   GET https://your-worker.your-subdomain.workers.dev?url=<encoded-rss-url>
 *
 * @errors
 *   400 - Missing URL parameter
 *   403 - URL not in allowlist (if configured)
 *   500 - Fetch error from target
 *
 * @security
 *   - Only allows GET requests
 *   - Optional: Configure ALLOWED_ORIGINS for CORS
 *   - Optional: Configure ALLOWED_URLS for URL filtering
 */

// Configuration
const ALLOWED_ORIGINS = ["*"]; // Or specify: ["https://yourdomain.github.io"]
const ALLOWED_URLS = null; // Or specify allowed RSS URLs: ["https://example.com/feed.xml"]
const CACHE_TTL = 300; // Cache for 5 minutes

/**
 * Handle incoming requests
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleRequest(request) {
  // Only allow GET requests
  if (request.method !== "GET") {
    return new Response("Method not allowed", { 
      status: 405,
      headers: getCorsHeaders(),
    });
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
          ...getCorsHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
  }

  // Validate URL
  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(targetUrl);
    new URL(decodedUrl); // Validate URL format
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Invalid URL format" }),
      { 
        status: 400, 
        headers: {
          ...getCorsHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
  }

  // Check allowlist if configured
  if (ALLOWED_URLS && !ALLOWED_URLS.includes(decodedUrl)) {
    return new Response(
      JSON.stringify({ error: "URL not allowed" }),
      { 
        status: 403, 
        headers: {
          ...getCorsHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
  }

  // Check cache
  const cache = caches.default;
  const cacheKey = new URL(request.url);
  let response = await cache.match(cacheKey);

  if (response) {
    return response;
  }

  // Fetch from target
  try {
    const targetResponse = await fetch(decodedUrl, {
      headers: {
        "User-Agent": "NewsAggregator/1.0 RSS Reader",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    // Clone response to modify headers
    const modifiedHeaders = new Headers(targetResponse.headers);
    
    // Add CORS headers
    const corsHeaders = getCorsHeaders();
    for (const [key, value] of Object.entries(corsHeaders)) {
      modifiedHeaders.set(key, value);
    }

    // Create new response with CORS headers
    response = new Response(targetResponse.body, {
      status: targetResponse.status,
      statusText: targetResponse.statusText,
      headers: modifiedHeaders,
    });

    // Cache the response
    const cacheResponse = response.clone();
    cacheResponse.headers.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
    await cache.put(cacheKey, cacheResponse);

    return response;
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch target URL", details: error.message }),
      { 
        status: 500, 
        headers: {
          ...getCorsHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
  }
}

/**
 * Get CORS headers
 * @returns {Object} - CORS headers
 */
function getCorsHeaders() {
  const origin = ALLOWED_ORIGINS.includes("*") ? "*" : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Handle OPTIONS requests for CORS preflight
 * @returns {Response}
 */
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

// Main export for Cloudflare Worker
export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return handleOptions();
    }
    return handleRequest(request);
  },
};

// Also support module.exports for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = { default: { fetch: handleRequest } };
}
