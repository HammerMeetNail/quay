/** A bounded, cancellable queue for deliberate page metadata enrichment. */
export class RequestQueue {
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(private readonly concurrency = 4) {
    if (
      !Number.isSafeInteger(concurrency) ||
      concurrency < 1 ||
      concurrency > 8
    )
      throw new Error('Invalid concurrency');
  }
  async run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.acquire(signal);
    try {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      return await task();
    } finally {
      this.active -= 1;
      this.waiting.shift()?.();
    }
  }
  private acquire(signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Cancelled', 'AbortError'));
        return;
      }
      const start = (): void => {
        signal?.removeEventListener('abort', abort);
        this.active += 1;
        resolve();
      };
      const abort = (): void => {
        const index = this.waiting.indexOf(start);
        if (index !== -1) this.waiting.splice(index, 1);
        reject(new DOMException('Cancelled', 'AbortError'));
      };
      if (this.active < this.concurrency) start();
      else {
        this.waiting.push(start);
        signal?.addEventListener('abort', abort, {once: true});
      }
    });
  }
}
