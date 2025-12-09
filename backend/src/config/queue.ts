// Queue Configuration - Internal Queue only
// Note: Kafka support removed due to Cloudflare Workers compatibility
// For high-volume production, consider deploying a separate Node.js service for Kafka

export interface GenerationJob {
    jobId: string;
    userId: string;
    prompt: string;
    parentId?: string;
    timestamp: string;
    templateId?: string;
}

export interface QueueAdapter {
    sendJob(job: GenerationJob): Promise<void>;
}

/**
 * Internal Queue Adapter (Raindrop native)
 */
class InternalQueueAdapter implements QueueAdapter {
    constructor(private queue: any) { }

    async sendJob(job: GenerationJob): Promise<void> {
        await this.queue.send(job);
    }
}

/**
 * Create queue adapter - always uses internal queue
 */
export function createQueueAdapter(internalQueue: any): QueueAdapter {
    if (!internalQueue) {
        throw new Error('Internal queue not provided');
    }

    console.log('Using internal queue');
    return new InternalQueueAdapter(internalQueue);
}
