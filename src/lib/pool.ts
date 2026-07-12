/** Run async tasks with a bounded concurrency (no dependency). */
export async function runPool<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
}
