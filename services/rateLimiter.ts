/**
 * Rate Limiter and Request Queue for LLM API
 * Prevents exceeding rate limits and manages concurrent requests
 */

type RequestType = 'generate' | 'edit' | 'expand' | 'portrait' | 'tts' | 'refine' | 'plan' | 'analyze' | 'analyze-arc';

export interface RequestTimingInfo {
  type: RequestType;
  id: string;
  queueWaitMs?: number;
  requestDurationMs?: number;
}

export interface RequestMeta {
  onDequeued?: (info: RequestTimingInfo) => void;
  onFinished?: (info: RequestTimingInfo) => void;
  onError?: (info: RequestTimingInfo & { error: unknown }) => void;
}

interface QueuedRequest {
  id: string;
  type: RequestType;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
  meta?: RequestMeta;
}

class RateLimiter {
  private queue: QueuedRequest[] = [];
  private activeRequests: Map<string, Promise<any>> = new Map();
  private lastRequestTime: Map<RequestType, number> = new Map();
  private requestCounts: Map<RequestType, number[]> = new Map();
  private processing = false;

  // Rate limits per request type (requests per minute)
  private readonly RATE_LIMITS: Record<RequestType, number> = {
    generate: 10,    // 10 chapter generations per minute
    edit: 15,        // 15 edits per minute
    expand: 20,      // 20 creative expansions per minute
    portrait: 10,    // 10 portrait generations per minute
    tts: 15,         // 15 text-to-speech per minute
    refine: 30,     // 30 refinements per minute
    plan: 10,        // 10 arc planning requests per minute
    analyze: 5,      // 5 editor analyses per minute
    'analyze-arc': 3, // 3 arc analyses per minute
  };

  // Minimum delay between requests of the same type (ms)
  private readonly MIN_DELAYS: Record<RequestType, number> = {
    generate: 6000,   // 6 seconds between chapter generations
    edit: 4000,       // 4 seconds between edits
    expand: 3000,     // 3 seconds between expansions
    portrait: 6000,   // 6 seconds between portraits
    tts: 4000,        // 4 seconds between TTS
    refine: 2000,     // 2 seconds between refinements
    plan: 6000,       // 6 seconds between planning calls
    analyze: 12000,   // 12 seconds between editor analyses
    'analyze-arc': 20000, // 20 seconds between arc analyses
  };

  // Maximum concurrent requests per type
  private readonly MAX_CONCURRENT: Record<RequestType, number> = {
    generate: 1,     // Only 1 chapter generation at a time
    edit: 1,         // Only 1 edit at a time
    expand: 2,       // 2 expansions can run concurrently
    portrait: 1,     // Only 1 portrait at a time
    tts: 1,          // Only 1 TTS at a time
    refine: 3,      // 3 refinements can run concurrently
    plan: 1,         // Only 1 plan at a time
    analyze: 1,      // Only 1 editor analysis at a time
    'analyze-arc': 1, // Only 1 arc analysis at a time
  };

  private getActiveCount(type: RequestType): number {
    let count = 0;
    for (const [key] of this.activeRequests) {
      if (key.startsWith(type)) count++;
    }
    return count;
  }

  private canExecute(type: RequestType): boolean {
    // Check concurrent limit
    if (this.getActiveCount(type) >= this.MAX_CONCURRENT[type]) {
      return false;
    }

    // Check minimum delay
    const lastTime = this.lastRequestTime.get(type);
    if (lastTime) {
      const timeSinceLastRequest = Date.now() - lastTime;
      if (timeSinceLastRequest < this.MIN_DELAYS[type]) {
        return false;
      }
    }

    // Check rate limit (requests per minute)
    const requests = this.requestCounts.get(type) || [];
    const oneMinuteAgo = Date.now() - 60000;
    const recentRequests = requests.filter(time => time > oneMinuteAgo);
    
    if (recentRequests.length >= this.RATE_LIMITS[type]) {
      return false;
    }

    return true;
  }

  private recordRequest(type: RequestType): void {
    const now = Date.now();
    this.lastRequestTime.set(type, now);
    
    const requests = this.requestCounts.get(type) || [];
    requests.push(now);
    // Keep only last minute of requests
    const oneMinuteAgo = now - 60000;
    this.requestCounts.set(type, requests.filter(time => time > oneMinuteAgo));
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue[0];
      
      if (this.canExecute(request.type)) {
        // Remove from queue
        this.queue.shift();

        const queueWaitMs = Date.now() - request.timestamp;
        request.meta?.onDequeued?.({ type: request.type, id: request.id, queueWaitMs });
        
        // Execute request
        const requestKey = `${request.type}-${request.id}`;
        const startTime = Date.now();
        const promise = request.execute()
          .then(result => {
            this.activeRequests.delete(requestKey);
            this.recordRequest(request.type);
            const requestDurationMs = Date.now() - startTime;
            request.meta?.onFinished?.({ type: request.type, id: request.id, requestDurationMs });
            request.resolve(result);
            return result;
          })
          .catch(error => {
            this.activeRequests.delete(requestKey);
            request.meta?.onError?.({ type: request.type, id: request.id, error });
            request.reject(error);
            throw error;
          });

        this.activeRequests.set(requestKey, promise);
      } else {
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    this.processing = false;
  }

  /**
   * Queue an API request with rate limiting
   */
  async queueRequest<T>(
    type: RequestType,
    execute: () => Promise<T>,
    requestId?: string,
    meta?: RequestMeta
  ): Promise<T> {
    const id = requestId || `${type}-${Date.now()}-${Math.random()}`;
    
    // Check if same request is already in queue or active
    const existingKey = Array.from(this.activeRequests.keys()).find(key => key.includes(id));
    if (existingKey) {
      return this.activeRequests.get(existingKey)!;
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id,
        type,
        execute,
        resolve,
        reject,
        timestamp: Date.now(),
        meta,
      });

      this.processQueue();
    });
  }

  /**
   * Get estimated wait time for a request type
   */
  getEstimatedWaitTime(type: RequestType): number {
    if (this.canExecute(type)) return 0;

    const lastTime = this.lastRequestTime.get(type);
    if (lastTime) {
      const timeSinceLastRequest = Date.now() - lastTime;
      const remainingDelay = this.MIN_DELAYS[type] - timeSinceLastRequest;
      if (remainingDelay > 0) return remainingDelay;
    }

    // Check rate limit
    const requests = this.requestCounts.get(type) || [];
    const oneMinuteAgo = Date.now() - 60000;
    const recentRequests = requests.filter(time => time > oneMinuteAgo);
    
    if (recentRequests.length >= this.RATE_LIMITS[type]) {
      const oldestRequest = Math.min(...recentRequests);
      return 60000 - (Date.now() - oldestRequest);
    }

    return 0;
  }

  /**
   * Clear the queue (useful for cleanup)
   */
  clearQueue(): void {
    this.queue.forEach(req => {
      req.reject(new Error('Request queue cleared'));
    });
    this.queue = [];
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();
