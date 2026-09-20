/**
 * A run of mono meta facts separated by the hairline `.sep`, which replaced the
 * middot across the system. Empty parts drop out, so callers can pass
 * conditionals straight through without assembling the string themselves.
 */
export default function MetaLine({ parts }: { parts: Array<string | false | null | undefined> }) {
  const kept = parts.filter((p): p is string => Boolean(p))
  return (
    <>
      {kept.map((part, i) => (
        <span key={part}>
          {i > 0 && <span className="sep" aria-hidden="true" />}
          {part}
        </span>
      ))}
    </>
  )
}
