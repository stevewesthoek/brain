import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PORT_OCCUPANCY_CACHE = new Map<number, { checkedAt: number; occupants: string[] }>();
const PORT_OCCUPANCY_IN_FLIGHT = new Map<number, Promise<string[]>>();
const PORT_OCCUPANCY_CACHE_MS = 2000;
const PORT_OCCUPANCY_TIMEOUT_MS = 2000;

/**
 * Get PIDs currently listening on a specific port.
 * If port is null/undefined, return [].
 * Safe: does not throw on missing listeners; returns [] instead.
 * Uses cache (2s) and in-flight deduplication to prevent concurrent lsof calls.
 * Lsof calls have 2s timeout to prevent hangs.
 */
export async function getPortOccupants(port: number | null): Promise<string[]> {
  if (!port) {
    return [];
  }

  const now = Date.now();

  // Check cache first
  const cached = PORT_OCCUPANCY_CACHE.get(port);
  if (cached && now - cached.checkedAt < PORT_OCCUPANCY_CACHE_MS) {
    return cached.occupants;
  }

  // Check if request is already in-flight
  const inFlight = PORT_OCCUPANCY_IN_FLIGHT.get(port);
  if (inFlight) {
    return inFlight;
  }

  // Create new in-flight promise
  const promise = (async () => {
    try {
      const { stdout } = await execFileAsync("lsof", ["-ti", `tcp:${port}`], {
        encoding: "utf-8",
        timeout: PORT_OCCUPANCY_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
      });

      if (!stdout) {
        return [];
      }

      const pids = stdout
        .split("\n")
        .map((pid) => pid.trim())
        .filter((pid) => pid.length > 0);

      // Cache the result
      PORT_OCCUPANCY_CACHE.set(port, { checkedAt: Date.now(), occupants: pids });
      return pids;
    } catch {
      // No process listening on the port, or lsof failed (timeout, error, etc.)
      // Cache empty result to prevent repeated failures
      PORT_OCCUPANCY_CACHE.set(port, { checkedAt: Date.now(), occupants: [] });
      return [];
    } finally {
      // Remove from in-flight map when done
      PORT_OCCUPANCY_IN_FLIGHT.delete(port);
    }
  })();

  PORT_OCCUPANCY_IN_FLIGHT.set(port, promise);
  return promise;
}

/**
 * Check if a port has any listeners.
 */
export async function isPortOccupied(port: number | null): Promise<boolean> {
  const occupants = await getPortOccupants(port);
  return occupants.length > 0;
}
