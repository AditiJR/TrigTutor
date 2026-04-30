import type { Problem } from '@/lib/types'

export const SEED_PROBLEMS: Problem[] = [
  {
    id: 'sin-30-special-angle',
    title: 'Evaluate sin(30°)',
    latex: '\\sin(30^\\circ) = ?',
    topic: 'special_angles',
    difficulty: 'intro',
    finalAnswer: '\\frac{1}{2}',
    multipleChoiceOptions: [
      '\\frac{1}{2}',
      '\\frac{\\sqrt{2}}{2}',
      '\\frac{\\sqrt{3}}{2}',
      '1'
    ],
    canonicalSteps: [
      {
        index: 0,
        description: 'Recall the value of sin(30°) from the unit circle / special angles.',
        expectedExpression: '\\sin(30^\\circ) = \\frac{1}{2}',
        conceptTag: 'special_angles',
        acceptableForms: ['\\frac{1}{2}', '0.5', '1/2']
      }
    ]
  },
  {
    id: 'pythag-identity-cos-from-sin',
    title: 'If sin(θ) = 1/2, find cos(θ) (assume θ is acute)',
    latex: '\\sin(\\theta) = \\tfrac{1}{2},\\ 0 < \\theta < \\tfrac{\\pi}{2}.\\ \\text{Find } \\cos(\\theta).',
    topic: 'pythagorean_identity',
    difficulty: 'practice',
    finalAnswer: '\\cos(\\theta) = \\frac{\\sqrt{3}}{2}',
    multipleChoiceOptions: [
      '\\cos^2(\\theta) = 1-\\sin^2(\\theta)',
      '\\cos(\\theta) = \\frac{\\sqrt{3}}{2}',
      '\\cos(\\theta) = \\frac{1}{2}',
      '\\cos(\\theta) = -\\frac{\\sqrt{3}}{2}'
    ],
    canonicalSteps: [
      {
        index: 0,
        description: 'Start from the Pythagorean identity.',
        expectedExpression: '\\sin^2(\\theta)+\\cos^2(\\theta)=1',
        conceptTag: 'pythagorean_identity',
        acceptableForms: ['\\cos^2(\\theta)=1-\\sin^2(\\theta)']
      },
      {
        index: 1,
        description: 'Isolate cos²(θ).',
        expectedExpression: '\\cos^2(\\theta)=1-\\sin^2(\\theta)',
        conceptTag: 'pythagorean_identity',
        acceptableForms: ['\\cos^2(\\theta)=1-(\\frac{1}{2})^2']
      },
      {
        index: 2,
        description: 'Substitute sin(θ)=1/2 and simplify.',
        expectedExpression: '\\cos^2(\\theta)=\\frac{3}{4}',
        conceptTag: 'algebra_simplification',
        acceptableForms: ['\\cos^2(\\theta)=1-\\frac14', '\\cos^2(\\theta)=0.75']
      },
      {
        index: 3,
        description: 'Take the positive root because θ is acute.',
        expectedExpression: '\\cos(\\theta)=\\frac{\\sqrt{3}}{2}',
        conceptTag: 'quadrant_reasoning',
        acceptableForms: ['\\cos(\\theta)=\\sqrt{\\frac34}', '\\frac{\\sqrt3}{2}']
      }
    ]
  },
  {
    id: 'sohcahtoa-find-side',
    title: 'Right triangle: find the missing side',
    latex: '\\text{In a right triangle, } \\sin(\\theta) = \\tfrac{3}{5},\\ \\text{hypotenuse} = 10.\\ \\text{Find the opposite side.}',
    topic: 'sin_cos_tan',
    difficulty: 'practice',
    finalAnswer: 'x = 6',
    multipleChoiceOptions: ['\\sin(\\theta)=\\frac{x}{10}', 'x=10\\cdot\\frac{3}{5}', 'x=6', 'x=\\frac{10}{3}'],
    canonicalSteps: [
      {
        index: 0,
        description: 'Apply SOH: sin = opposite/hypotenuse.',
        expectedExpression: '\\sin(\\theta)=\\frac{x}{10}',
        conceptTag: 'sohcahtoa',
        acceptableForms: ['\\frac{x}{10}=\\sin(\\theta)']
      },
      {
        index: 1,
        description: 'Substitute the known sine ratio.',
        expectedExpression: '\\frac{3}{5}=\\frac{x}{10}',
        conceptTag: 'substitution',
        acceptableForms: ['\\frac{x}{10}=\\frac35']
      },
      {
        index: 2,
        description: 'Solve for x.',
        expectedExpression: 'x=10\\cdot\\frac{3}{5}',
        conceptTag: 'algebra_simplification',
        acceptableForms: ['x=\\frac{30}{5}', 'x=6']
      },
      {
        index: 3,
        description: 'Final simplified side length.',
        expectedExpression: 'x=6',
        conceptTag: 'final_answer',
        acceptableForms: ['6']
      }
    ]
  },
  {
    id: 'solve-sin-equals-root2-over-2',
    title: 'Solve sin(x) = √2/2 for x in [0, 2π)',
    latex: '\\sin(x) = \\tfrac{\\sqrt{2}}{2},\\ x \\in [0, 2\\pi)',
    topic: 'solving_equations',
    difficulty: 'practice',
    finalAnswer: 'x = \\tfrac{\\pi}{4},\\ \\tfrac{3\\pi}{4}',
    multipleChoiceOptions: ['\\text{reference angle}=\\frac{\\pi}{4}', 'x=\\frac{\\pi}{4}', 'x=\\frac{3\\pi}{4}', 'x=\\frac{5\\pi}{4}'],
    canonicalSteps: [
      {
        index: 0,
        description: 'Identify the reference angle.',
        expectedExpression: '\\alpha=\\frac{\\pi}{4}',
        conceptTag: 'special_angles',
        acceptableForms: ['\\text{reference angle}=\\frac{\\pi}{4}', '\\sin\\left(\\frac{\\pi}{4}\\right)=\\frac{\\sqrt2}{2}']
      },
      {
        index: 1,
        description: 'Use sine sign by quadrant.',
        expectedExpression: 'x=\\frac{\\pi}{4}\\ \\text{or}\\ x=\\frac{3\\pi}{4}',
        conceptTag: 'quadrant_reasoning',
        acceptableForms: ['x\\in\\left\\{\\frac{\\pi}{4},\\frac{3\\pi}{4}\\right\\}', 'x=\\frac{\\pi}{4},\\frac{3\\pi}{4}']
      }
    ]
  },
  {
    id: 'unit-circle-cos-pi-over-3',
    title: 'Read cos(π/3) from the unit circle',
    latex: '\\cos\\!\\left(\\tfrac{\\pi}{3}\\right) = ?',
    topic: 'unit_circle',
    difficulty: 'intro',
    finalAnswer: '\\frac{1}{2}',
    multipleChoiceOptions: ['\\frac{1}{2}', '\\frac{\\sqrt{3}}{2}', '-\\frac{1}{2}', '1'],
    canonicalSteps: [
      {
        index: 0,
        description: 'Read x-coordinate at π/3 on unit circle.',
        expectedExpression: '\\cos\\left(\\frac{\\pi}{3}\\right)=\\frac{1}{2}',
        conceptTag: 'unit_circle',
        acceptableForms: ['\\frac{1}{2}', '0.5']
      }
    ]
  },
  {
    id: 'cofunction-identity',
    title: 'Use a co-function identity to rewrite sin(π/2 − x)',
    latex: '\\text{Rewrite } \\sin\\!\\left(\\tfrac{\\pi}{2} - x\\right) \\text{ using a co-function identity.}',
    topic: 'sin_cos_tan',
    difficulty: 'practice',
    finalAnswer: '\\cos(x)',
    multipleChoiceOptions: ['\\cos(x)', '\\sin(x)', '-\\cos(x)', '\\tan(x)'],
    canonicalSteps: [
      {
        index: 0,
        description: 'Apply co-function identity sin(π/2−x)=cos(x).',
        expectedExpression: '\\sin\\left(\\frac{\\pi}{2}-x\\right)=\\cos(x)',
        conceptTag: 'cofunction_identity',
        acceptableForms: ['\\cos(x)']
      }
    ]
  },
  {
    id: 'ladder-word-problem',
    title: 'Ladder against a wall',
    latex: '\\text{A 12 ft ladder leans on a wall at } 60^\\circ \\text{ to the ground. How high up the wall does it reach?}',
    topic: 'sin_cos_tan',
    difficulty: 'challenge',
    finalAnswer: 'h = 6\\sqrt{3}\\ \\text{ft}',
    multipleChoiceOptions: ['\\sin(60^\\circ)=\\frac{h}{12}', 'h=12\\sin(60^\\circ)', 'h=6\\sqrt{3}', 'h=12\\sqrt{3}'],
    canonicalSteps: [
      {
        index: 0,
        description: 'Set up sine ratio.',
        expectedExpression: '\\sin(60^\\circ)=\\frac{h}{12}',
        conceptTag: 'sohcahtoa',
        acceptableForms: ['\\frac{h}{12}=\\sin(60^\\circ)']
      },
      {
        index: 1,
        description: 'Isolate h.',
        expectedExpression: 'h=12\\sin(60^\\circ)',
        conceptTag: 'algebra_simplification',
        acceptableForms: ['h=12\\cdot\\frac{\\sqrt3}{2}']
      },
      {
        index: 2,
        description: 'Evaluate sin(60°)=√3/2.',
        expectedExpression: 'h=6\\sqrt3',
        conceptTag: 'special_angles',
        acceptableForms: ['h=6\\sqrt{3}', '6\\sqrt3']
      }
    ]
  },
  {
    id: 'inverse-trig-find-angle',
    title: 'Find θ if tan(θ) = 1, 0 < θ < π/2',
    latex: '\\tan(\\theta) = 1,\\ 0 < \\theta < \\tfrac{\\pi}{2}.\\ \\text{Find } \\theta.',
    topic: 'inverse_functions',
    difficulty: 'practice',
    finalAnswer: '\\theta = \\tfrac{\\pi}{4}',
    multipleChoiceOptions: ['\\theta=\\arctan(1)', '\\theta=\\frac{\\pi}{4}', '\\theta=\\frac{\\pi}{2}', '\\theta=\\frac{3\\pi}{4}'],
    canonicalSteps: [
      {
        index: 0,
        description: 'Apply inverse tangent.',
        expectedExpression: '\\theta=\\arctan(1)',
        conceptTag: 'inverse_trig',
        acceptableForms: ['\\arctan(1)=\\theta']
      },
      {
        index: 1,
        description: 'Evaluate principal acute angle.',
        expectedExpression: '\\theta=\\frac{\\pi}{4}',
        conceptTag: 'special_angles',
        acceptableForms: ['\\frac{\\pi}{4}']
      }
    ]
  },
  {
    id: 'quadrant-sign-reasoning',
    title: 'Sign of cos(θ) in Q3',
    latex: '\\text{If } \\theta \\text{ is in quadrant III, what is the sign of } \\cos(\\theta)?',
    topic: 'unit_circle',
    difficulty: 'intro',
    finalAnswer: '\\cos(\\theta)<0',
    multipleChoiceOptions: ['\\cos(\\theta)<0', '\\cos(\\theta)>0', '\\cos(\\theta)=0', '\\cos(\\theta)\\text{ undefined}'],
    canonicalSteps: [
      {
        index: 0,
        description: 'In Q3, x-coordinate is negative so cosine is negative.',
        expectedExpression: '\\cos(\\theta)<0',
        conceptTag: 'quadrant_reasoning',
        acceptableForms: ['-\\cos(\\theta)>0']
      }
    ]
  },
  {
    id: 'two-step-identity-plus-algebra',
    title: 'Combined identity + algebra',
    latex: '\\text{Given } \\sin(2x) = 1,\\ x \\in [0, 2\\pi),\\ \\text{find all } x.',
    topic: 'solving_equations',
    difficulty: 'challenge',
    finalAnswer: 'x = \\tfrac{\\pi}{4},\\ \\tfrac{5\\pi}{4}',
    multipleChoiceOptions: ['2x=\\frac{\\pi}{2}+2\\pi k', 'x=\\frac{\\pi}{4}+\\pi k', 'x=\\frac{\\pi}{4},\\frac{5\\pi}{4}', 'x=\\frac{\\pi}{2},\\frac{3\\pi}{2}'],
    canonicalSteps: [
      {
        index: 0,
        description: 'Solve sin(2x)=1 general solution.',
        expectedExpression: '2x=\\frac{\\pi}{2}+2\\pi k',
        conceptTag: 'solving_equations',
        acceptableForms: ['2x=\\frac{\\pi}{2}+2\\pi n']
      },
      {
        index: 1,
        description: 'Divide by 2.',
        expectedExpression: 'x=\\frac{\\pi}{4}+\\pi k',
        conceptTag: 'algebra_simplification',
        acceptableForms: ['x=\\frac{\\pi}{4}+\\pi n']
      },
      {
        index: 2,
        description: 'List solutions in [0,2π).',
        expectedExpression: 'x=\\frac{\\pi}{4},\\frac{5\\pi}{4}',
        conceptTag: 'domain_restriction',
        acceptableForms: ['x\\in\\left\\{\\frac{\\pi}{4},\\frac{5\\pi}{4}\\right\\}']
      }
    ]
  }
]
