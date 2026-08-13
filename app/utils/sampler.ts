/**
 * Creates a function that samples calls at regular intervals and captures trailing calls.
 * - Drops calls that occur between sampling intervals
 * - Takes one call per sampling interval if available
 * - Captures the last call if no call was made during the interval
 *
 * @param fn The function to sample
 * @param sampleInterval How often to sample calls (in ms), or a function that returns the interval
 * @returns The sampled function
 */
export function createSampler<T extends (...args: any[]) => any>(
  fn: T,
  sampleInterval: number | (() => number),
): T {
  let lastArgs: Parameters<T> | null = null;
  let lastTime = 0;
  let timeout: NodeJS.Timeout | null = null;

  // Create a function with the same type as the input function
  const sampled = function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    lastArgs = args;

    // Resolve interval value
    const intervalMs = typeof sampleInterval === 'function' ? sampleInterval() : sampleInterval;

    // If we're within the sample interval, just store the args
    if (now - lastTime < intervalMs) {
      // Set up trailing call if not already set
      if (!timeout) {
        timeout = setTimeout(
          () => {
            timeout = null;
            lastTime = Date.now();

            if (lastArgs) {
              fn.apply(this, lastArgs);
              lastArgs = null;
            }
          },
          intervalMs - (now - lastTime),
        );
      }

      return;
    }

    // If we're outside the interval, execute immediately
    lastTime = now;
    fn.apply(this, args);
    lastArgs = null;
  } as T;

  return sampled;
}
