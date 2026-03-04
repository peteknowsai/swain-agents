#!/usr/bin/env bun

/**
 * Worker HTTP Client
 * Shared utility for Swain CLI to call API endpoints
 *
 * Now points to Convex HTTP actions instead of the Bun server.
 * Set SWAIN_API_URL to your Convex site URL (e.g., https://your-app.convex.site)
 */

// Environment URLs — Convex HTTP actions
const PROD_URL = 'https://wandering-sparrow-224.convex.site';
const ENV_URLS: Record<string, string> = {
  local: process.env.SWAIN_API_URL || PROD_URL,
  dev: process.env.SWAIN_API_URL || PROD_URL,
  prod: process.env.SWAIN_API_URL || PROD_URL,
  production: process.env.SWAIN_API_URL || PROD_URL,
};

// Cache for auto-detected URL
let cachedAutoUrl: string | null = null;

// Get URL from --env flag or SWAIN_API_URL env var
function getWorkerUrl(): string {
  // Check for --env flag in process args
  const envArg = process.argv.find(arg => arg.startsWith('--env='));
  if (envArg) {
    const env = envArg.split('=')[1];
    const url = ENV_URLS[env.toLowerCase()];
    if (!url) {
      console.error(`Unknown environment: ${env}. Valid: local, prod`);
      process.exit(1);
    }
    return url;
  }

  // Check SWAIN_API_URL env var
  if (process.env.SWAIN_API_URL) {
    return process.env.SWAIN_API_URL;
  }

  // Return cached auto-detected URL if available
  if (cachedAutoUrl) {
    return cachedAutoUrl;
  }

  // Default to prod
  return ENV_URLS.prod;
}

// Check if --verbose flag is present
function isVerbose(): boolean {
  return process.argv.includes('--verbose') || process.argv.includes('-v');
}

// Auto-detect local dev server (called once per session)
async function autoDetectEnvironment(): Promise<string> {
  if (cachedAutoUrl) {
    if (isVerbose()) {
      console.error(`[CLI] Using cached API: ${cachedAutoUrl}`);
    }
    return cachedAutoUrl;
  }

  // Skip auto-detect if explicitly set
  const envArg = process.argv.find(arg => arg.startsWith('--env='));
  if (envArg || process.env.SWAIN_API_URL) {
    cachedAutoUrl = getWorkerUrl();
    if (isVerbose()) {
      console.error(`[CLI] Using explicit API: ${cachedAutoUrl}`);
    }
    return cachedAutoUrl;
  }

  // Use the Convex site URL directly (no local server to detect)
  cachedAutoUrl = ENV_URLS.prod;
  if (isVerbose()) {
    console.error(`[CLI] Using production API: ${cachedAutoUrl}`);
  }
  return cachedAutoUrl;
}

const ADMIN_TOKEN = process.env.SWAIN_API_TOKEN;

export interface WorkerRequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Make authenticated request to worker API with retry logic
 */
export async function workerRequest(
  endpoint: string,
  options: WorkerRequestOptions = {}
): Promise<any> {
  // Auto-detect environment on first request
  const workerUrl = await autoDetectEnvironment();

  // Build URL — if endpoint already starts with /api, use as-is
  // Otherwise, ensure it's prefixed with /api for Convex HTTP routes
  let path = endpoint;
  if (!path.startsWith('/api') && !path.startsWith('/health') && !path.startsWith('http')) {
    path = `/api${path}`;
  }
  const url = path.startsWith('http') ? path : `${workerUrl}${path}`;

  const maxRetries = 3;
  const retryDelays = [500, 1000, 2000]; // ms

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(ADMIN_TOKEN ? { 'Authorization': `Bearer ${ADMIN_TOKEN}` } : {}),
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API request failed [${response.status}]: ${error}`);
      }

      return await response.json();
    } catch (err: any) {
      lastError = err;

      // Don't retry on 4xx errors (client errors)
      if (err.message?.includes('[4')) {
        throw err;
      }

      // Log retry attempt if verbose
      if (isVerbose() && attempt < maxRetries - 1) {
        console.error(`[CLI] Request failed (attempt ${attempt + 1}/${maxRetries}): ${err.message}`);
        console.error(`[CLI] Retrying in ${retryDelays[attempt]}ms...`);
      }

      // Wait before retry (except on last attempt)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

/**
 * Format output as JSON
 */
export function output(data: any): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Format error and exit
 */
export function error(message: string, code?: string): never {
  console.error(JSON.stringify({
    success: false,
    error: message,
    code: code || 'CLI_ERROR'
  }, null, 2));
  process.exit(1);
}

/**
 * Print colored output (for non-JSON mode)
 */
export const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

export function print(message: string): void {
  console.log(message);
}

export function printSuccess(message: string): void {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

export function printWarning(message: string): void {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

export function printError(message: string): void {
  console.error(`${colors.red}✗${colors.reset} ${message}`);
}

/**
 * Get the base URL for API requests (for streaming endpoints)
 */
export async function getBaseUrl(): Promise<string> {
  return await autoDetectEnvironment();
}
