export type JobData = {
    type: string;
    payload: any;
};
export interface EnqueueResult {
    id?: string | number;
    queued: boolean;
}
export interface QueueAPI {
    enqueue(job: JobData): Promise<EnqueueResult>;
    close(): Promise<void>;
}
export declare function createQueue(): Promise<QueueAPI | null>;
//# sourceMappingURL=queue.d.ts.map