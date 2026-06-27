/**
 * Solux Worker
 *
 * In local development, the API calls screening jobs synchronously.
 * This worker app is the scaffold for moving jobs to a real queue
 * (BullMQ + Redis, or DigitalOcean Managed Redis).
 *
 * TODO: Implement job queue with BullMQ
 * TODO: Add job retry logic
 * TODO: Add job progress reporting
 * TODO: Add structured logging
 */

console.log('Solux worker started. No jobs queued yet.')
console.log('In local dev, screening jobs run synchronously in the API process.')
