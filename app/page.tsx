import Link from 'next/link'
import { ImageUpload } from '@/components/ImageUpload'
import { ProblemDisplay } from '@/components/ProblemDisplay'
import { SEED_PROBLEMS } from '@/data/problems'

export default function HomePage() {
  return (
    <main className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Trig Tutor</h1>
        <p className="text-slate-600">
          Pick a problem to practice, or upload a photo of one from your homework.
          You&apos;ll work through it step-by-step — the tutor will only ask questions,
          never give you the answer.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Upload a problem</h2>
        <ImageUpload />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Or pick a practice problem</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SEED_PROBLEMS.map((problem) => (
            <li key={problem.id}>
              <Link
                href={`/solve/${problem.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow"
              >
                <div className="mb-2 text-sm uppercase tracking-wide text-slate-500">
                  {problem.topic.replace(/_/g, ' ')} · {problem.difficulty}
                </div>
                <div className="mb-2 font-medium">{problem.title}</div>
                <ProblemDisplay latex={problem.latex} block={false} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
