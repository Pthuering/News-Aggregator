/**
 * @module hash
 * @purpose Erzeugt SHA-256 Hash aus einem String (für Artikel-IDs)
 *
 * @reads    nichts
 * @writes   nichts
 * @calledBy services/feedService.js → Hash der Artikel-URL als ID
 *
 * @exports
 *   hashString(input: string): Promise<string>
 *     → Gibt Hex-String des SHA-256 Hash zurück
 */

/**
 * Creates a SHA-256 hash of a string and returns it as a hex string
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
  hashString,
};
