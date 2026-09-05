/**
 * Onboarding step rail (mobile-web 22–24): "01 — ACCOUNT ——— 02 ——— 03". Done steps
 * show "✓ 01", the current step carries its name and an ink underline, the lines between
 * turn ink once the step before them is done. Server-safe (no state).
 */
export const ONBOARDING_STEPS = ['ACCOUNT', 'PREFERENCES', 'VERIFY'] as const

export default function StepRail({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="step-rail" aria-label={`Step ${current} of ${ONBOARDING_STEPS.length}`}>
      {ONBOARDING_STEPS.map((name, i) => {
        const n = i + 1
        const done = n < current
        const on = n === current
        const num = String(n).padStart(2, '0')
        return (
          <span key={name} className="step-rail__item">
            {i > 0 && <span className={`step-rail__line${done || on ? ' is-on' : ''}`} />}
            <span className={`step-rail__step${on ? ' is-on' : ''}${done ? ' is-done' : ''}`}>
              {done ? `✓ ${num}` : on ? `${num} — ${name}` : num}
            </span>
          </span>
        )
      })}
    </div>
  )
}
