/**
 * @module cors-proxy
 * @purpose Cloudflare Worker for RSS feed CORS proxying and NVIDIA API
 *
 * Endpoints:
 * - GET /?url=https://example.com/feed.xml - RSS Proxy
 * - POST /api/nvidia - NVIDIA API Proxy
 *
 * Environment Secrets:
 * - NVIDIA_API_KEY: Fallback API key used when client sends no Authorization header
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
      return handleNvidiaProxy(request, env);
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
 * Handle NVIDIA API proxy requests.
 * Uses client-provided Authorization header if present,
 * otherwise falls back to the worker's NVIDIA_API_KEY secret.
 */
async function handleNvidiaProxy(request, env) {
  try {
    const body = await request.json();
    const isStream = body.stream === true;
    
    // Use client key if provided, otherwise fall back to worker secret
    const clientAuth = request.headers.get("Authorization");
    const hasClientKey = clientAuth && clientAuth !== "Bearer " && clientAuth !== "Bearer undefined" && clientAuth !== "Bearer null";
    const authorization = hasClientKey
      ? clientAuth
      : (env.NVIDIA_API_KEY ? `Bearer ${env.NVIDIA_API_KEY}` : "");

    if (!authorization) {
      return new Response(
        JSON.stringify({ error: "No API key configured. Set NVIDIA_API_KEY secret on the worker or provide Authorization header." }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Forward to NVIDIA API
    const nvidiaResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authorization,
      },
      body: JSON.stringify(body),
    });

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // For streaming: pipe the response body through directly
    if (isStream && nvidiaResponse.ok && nvidiaResponse.body) {
      return new Response(nvidiaResponse.body, {
        status: nvidiaResponse.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...corsHeaders,
        },
      });
    }

    // Non-streaming: buffer and return
    const responseBody = await nvidiaResponse.arrayBuffer();
    
    return new Response(responseBody, {
      status: nvidiaResponse.status,
      statusText: nvidiaResponse.statusText,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
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
