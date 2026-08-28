import crypto from 'node:crypto';
import fs from 'node:fs';

/**
 * Fast deterministic string hash.
 * @param {string} str Input string
 * @returns {string} 16-character hex hash
 */
export function hashString(str) {
  if (!str) return '0000000000000000';
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

/**
 * Fast deterministic object hash (sorted keys for stability).
 * @param {object} obj Input object
 * @returns {string} 16-character hex hash
 */
export function hashObject(obj) {
  if (!obj) return '0000000000000000';
  try {
    const sortedStr = JSON.stringify(obj, Object.keys(obj).sort());
    return hashString(sortedStr);
  } catch (e) {
    return hashString(String(obj));
  }
}

/**
 * Fast deterministic file content hash.
 * @param {string} filePath Absolute file path
 * @returns {string} 16-character hex hash
 */
export function hashFile(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  } catch (e) {
    return '0000000000000000';
  }
}
