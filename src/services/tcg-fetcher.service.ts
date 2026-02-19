import axios, { AxiosError } from 'axios';
import { config } from '../config/configuration.js';

const DEFAULT_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch JSON from URL with timeout and exponential backoff retry for 429/5xx.
 */
export async function fetchJSON<T>(url: string): Promise<T> {
  const timeout = config.tcg.requestTimeout;
  const maxAttempts = DEFAULT_RETRIES;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get<T>(url, {
        timeout,
        headers: {
          'User-Agent': 'JustTheRip-TCG-Sync/1.0',
        },
      });
      return response.data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const axiosError = err as AxiosError<unknown>;
      const status = axiosError.response?.status;
      const isRetryable =
        status != null && isRetryableStatus(status) && attempt < maxAttempts;

      if (isRetryable) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.warn(
          `[tcg-fetcher] ${url} failed (${status}), retry ${attempt}/${maxAttempts} in ${backoffMs}ms`
        );
        await sleep(backoffMs);
      } else {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error('Unknown fetch error');
}
