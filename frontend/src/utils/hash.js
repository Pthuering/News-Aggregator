/**
 * @module hash
 * @purpose SHA-256 hashing utilities for article IDs
 *
 * @dataflow string → SHA-256 hash → hex string
 *
 * @exports
 *   generateArticleId(url: string): string – Creates SHA-256 hash from URL
 *   hashString(input: string): Promise<string> – Generic SHA-256 hasher
 */

/**
 * Generates a SHA-256 hash from a URL for use as article ID
 * @param {string} url - The article URL
 * @returns {Promise<string>} - Hex-encoded SHA-256 hash (first 16 chars)
 */
export async function generateArticleId(url) {
  const fullHash = await hashString(url);
  // Use first 16 characters for readable IDs while maintaining uniqueness
  return fullHash.substring(0, 16);
}

/**
 * Creates a SHA-256 hash of any string
 * @param {string} input - String to hash
 * @returns {Promise<string>} - Hex-encoded SHA-256 hash
 */
export async function hashString(input) {
  // Encode the input as UTF-8
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  // Generate SHA-256 hash using Web Crypto API
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

export default {
  generateArticleId,
  hashString,
};
