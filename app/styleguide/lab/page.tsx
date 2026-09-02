import type { Metadata } from 'next'
import LabClient from './lab-client'

export const metadata: Metadata = {
  title: 'Lab',
  robots: { index: false, follow: false },
}

export default function LabPage() {
  return <LabClient />
}
