'use client'

import Link from 'next/link'
import { ImageUpload } from '@/components/ImageUpload'
import { SEED_PROBLEMS } from '@/data/problems'
import type { Problem } from '@/lib/types'
import { InlineMath } from 'react-katex'

const DIFFICULTY_CONFIG = {
  intro: { stars: 1, label: 'Easy' },
  practice: { stars: 2, label: 'Medium' },
  challenge: { stars: 3, label: 'Hard' }
} as const

function DifficultyBadge({ difficulty }: { difficulty: Problem['difficulty'] }) {
  const config = DIFFICULTY_CONFIG[difficulty]
  return (
    <span className="flex items-center gap-1 text-warning font-label text-label whitespace-nowrap shrink-0">
      <span className="flex items-center" aria-hidden="true">
        {Array.from({ length: config.stars }).map((_, i) => (
          <span
            key={i}
            className="material-symbols-outlined"
            style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}
          >
            star
          </span>
        ))}
      </span>
      <span>{config.label}</span>
    </span>
  )
}

function TopicBadge({ topic }: { topic: Problem['topic'] }) {
  const label = topic
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
  return (
    <span className="bg-surface-container-high text-on-surface-variant font-label text-label px-2 py-1 rounded">
      {label}
    </span>
  )
}

function ProblemCard({ problem }: { problem: Problem }) {
  return (
    <Link href={`/solve/${problem.id}`} className="block group h-full">
      <article className="bg-surface border border-border-subtle rounded-lg shadow-sm p-5 flex flex-col gap-3 hover:border-primary-fixed transition-colors cursor-pointer h-full min-h-[260px]">
        <div className="flex justify-between items-start gap-2">
          <TopicBadge topic={problem.topic} />
          <DifficultyBadge difficulty={problem.difficulty} />
        </div>
        <h3 className="font-body text-body font-semibold text-on-surface line-clamp-2">
          {problem.title}
        </h3>
        <div className="bg-surface-container-low p-4 rounded text-center border border-outline-variant/30 flex-grow flex items-center justify-center min-h-[80px] overflow-hidden">
          <div className="text-on-surface text-[14px] max-w-full overflow-x-auto overflow-y-hidden">
            <InlineMath math={problem.latex} />
          </div>
        </div>
        <button className="w-full py-2 mt-auto border border-primary text-primary font-label text-label rounded hover:bg-primary-fixed/20 transition-colors group-hover:bg-primary group-hover:text-on-primary pointer-events-none">
          Start Solving
        </button>
      </article>
    </Link>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Nav */}
      <nav className="bg-surface/80 backdrop-blur-md fixed top-0 w-full z-50 border-b border-border-subtle shadow-sm">
        <div className="flex justify-between items-center max-w-[1024px] mx-auto px-6 h-16">
          <div className="text-xl font-bold tracking-tight text-on-surface font-h1">
            SocraticTrig
          </div>
          <div className="hidden md:flex gap-6">
            <a
              href="#"
              className="text-primary border-b-2 border-primary pb-1 font-semibold text-body-sm transition-colors"
            >
              Practice
            </a>
            <a
              href="#"
              className="text-secondary font-label text-body-sm hover:text-primary transition-colors"
            >
              My History
            </a>
            <a
              href="#"
              className="text-secondary font-label text-body-sm hover:text-primary transition-colors"
            >
              Formula Sheet
            </a>
          </div>
          <div className="flex items-center gap-4 text-primary">
            <button className="hover:text-primary/70 transition-colors" aria-label="Notifications">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="hover:text-primary/70 transition-colors" aria-label="Account">
              <span className="material-symbols-outlined">account_circle</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-grow pt-24 pb-12 px-6 max-w-[1024px] mx-auto w-full flex flex-col gap-stack-lg">
        {/* Hero header */}
        <header className="text-center max-w-2xl mx-auto pt-8 pb-4">
          <h1 className="font-h1 text-h1 text-on-background mb-4">Trig Tutor</h1>
          <p className="font-body text-body text-secondary">
            Never give away the answer — only guide you to it.
          </p>
        </header>

        {/* Upload area */}
        <section className="bg-surface border border-outline-variant rounded-xl shadow-sm p-8 text-center transition-all hover:border-primary-container relative overflow-hidden group">
          <div className="absolute inset-0 bg-primary-fixed/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center gap-stack-sm">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-primary mb-2">
              <span className="material-symbols-outlined text-3xl">upload_file</span>
            </div>
            <h2 className="font-h2 text-h2 text-on-surface">Upload a problem</h2>
            <p className="font-body-sm text-body-sm text-secondary mb-4">
              Drag and drop a screenshot or image of your math problem here.
            </p>
            <ImageUpload />
          </div>
        </section>

        {/* Problem grid */}
        <section className="flex flex-col gap-stack-md">
          <div className="flex justify-between items-end mb-2">
            <h2 className="font-h2 text-h2 text-on-surface">Pick a practice problem</h2>
            <a href="#" className="font-label text-label text-primary hover:underline">
              View all
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SEED_PROBLEMS.map((problem) => (
              <ProblemCard key={problem.id} problem={problem} />
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-background w-full py-8 mt-auto border-t border-border-subtle">
        <div className="flex flex-col md:flex-row justify-between items-center max-w-[1024px] mx-auto px-6 gap-4">
          <div className="text-secondary font-label text-label">
            © 2025 SocraticTrig. Non-judgmental math guidance.
          </div>
          <div className="flex gap-4">
            <a href="#" className="text-secondary hover:text-on-surface transition-colors font-label text-label">
              Support
            </a>
            <a href="#" className="text-secondary hover:text-on-surface transition-colors font-label text-label">
              Privacy
            </a>
            <a href="#" className="text-secondary hover:text-on-surface transition-colors font-label text-label">
              Methodology
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
