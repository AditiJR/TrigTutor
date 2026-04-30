'use client'

import type { Problem } from './types'

const STORAGE_KEY = 'trig-tutor-custom-problems'

type CustomProblemMap = Record<string, Problem>

export function saveCustomProblem(problem: Problem): void {
  const current = readCustomProblemMap()
  current[problem.id] = problem
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch (err) {
    console.error('Failed to persist custom OCR problem:', err)
  }
}

export function getCustomProblem(problemId: string): Problem | null {
  const current = readCustomProblemMap()
  return current[problemId] ?? null
}

function readCustomProblemMap(): CustomProblemMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as CustomProblemMap
  } catch {
    return {}
  }
}
