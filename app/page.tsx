import { redirect } from 'next/navigation'

// Home → /browse for everyone. Browsing is public now (guests included); the
// browse feed itself decides what a signed-out visitor sees. No auth check here.
export default async function HomePage() {
  redirect('/browse')
}
