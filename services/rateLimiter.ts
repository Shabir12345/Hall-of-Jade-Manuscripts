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

  // Rate limits per request type (requests per minute) - OPTIMIZED: Increased limits
  private readonly RATE_LIMITS: Record<RequestType, number> = {
    generate: 20,    // Increased from 10 - 20 chapter generations per minute
    edit: 30,        // Increased from 15 - 30 edits per minute
    expand: 40,      // Increased from 20 - 40 creative expansions per minute
    portrait: 20,    // Increased from 10 - 20 portrait generations per minute
    tts: 30,         // Increased from 15 - 30 text-to-speech per minute
    refine: 60,      // Increased from 30 - 60 refinements per minute
    plan: 20,        // Increased from 10 - 20 arc planning requests per minute
    analyze: 10,     // Increased from 5 - 10 editor analyses per minute
    'analyze-arc': 6, // Increased from 3 - 6 arc analyses per minute
  };

  // Minimum delay between requests of the same type (ms) - OPTIMIZED: Reduced delays
  private readonly MIN_DELAYS: Record<RequestType, number> = {
    generate: 3000,   // Reduced from 6000ms - 3 seconds between chapter generations
    edit: 2000,       // Reduced from 4000ms - 2 seconds between edits
    expand: 1500,     // Reduced from 3000ms - 1.5 seconds between expansions
    portrait: 3000,   // Reduced from 6000ms - 3 seconds between portraits
    tts: 2000,        // Reduced from 4000ms - 2 seconds between TTS
    refine: 1000,     // Reduced from 2000ms - 1 second between refinements
    plan: 3000,       // Reduced from 6000ms - 3 seconds between planning calls
    analyze: 6000,    // Reduced from 12000ms - 6 seconds between editor analyses
    'analyze-arc': 10000, // Reduced from 20000ms - 10 seconds between arc analyses
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
