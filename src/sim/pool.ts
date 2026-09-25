import { Worker } from 'node:worker_threads'
import type { GroupMetrics } from './runGroup'
import type { SessionMetrics, SessionTranscript } from './runSession'
import type { Job } from './worker'

// A tiny worker pool shared by the sim CLI and the baseline guard. Each worker runs
// TypeScript through the same loader (tsx) as the parent process.

export interface JobResults {
  solo: SessionMetrics[]
  transcripts: SessionTranscript[]
  group: GroupMetrics[]
}

export async function runJobs(jobs: Job[], workers: number, quiet = false): Promise<JobResults> {
  const solo: SessionMetrics[] = []
  const transcripts: SessionTranscript[] = []
  const group: GroupMetrics[] = []
  const queue = [...jobs]
  let done = 0
  const pool = Array.from(
    { length: Math.min(workers, jobs.length) },
    () => new Worker(new URL('./worker.ts', import.meta.url), { execArgv: process.execArgv }),
  )
  await Promise.all(
    pool.map(
      (w) =>
        new Promise<void>((resolve, reject) => {
          const next = () => {
            const job = queue.shift()
            if (!job) return resolve()
            w.postMessage(job)
          }
          w.on('message', (msg: { kind: string; metrics: never[]; transcripts?: SessionTranscript[] }) => {
            if (msg.kind === 'solo') {
              solo.push(...(msg.metrics as SessionMetrics[]))
              transcripts.push(...(msg.transcripts ?? []))
            } else group.push(...(msg.metrics as GroupMetrics[]))
            done++
            if (!quiet) process.stdout.write(`\r  ${done}/${jobs.length} jobs`)
            next()
          })
          w.on('error', reject)
          next()
        }),
    ),
  )
  await Promise.all(pool.map((w) => w.terminate()))
  if (!quiet) process.stdout.write('\n')
  return { solo, transcripts, group }
}

export const seedList = (n: number) => Array.from({ length: n }, (_, i) => i + 1)
export const chunk = (xs: number[], size: number) =>
  Array.from({ length: Math.ceil(xs.length / size) }, (_, i) => xs.slice(i * size, (i + 1) * size))
