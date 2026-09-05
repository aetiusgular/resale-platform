/**
 * /orders → /settings/orders. Orders live inside Settings (reference ORDERS
 * section); the old index URL and its ?role= filter keep working via redirect.
 * Order detail stays at /orders/[id].
 */
import { redirect } from 'next/navigation'

interface PageProps {
  searchParams: Promise<{ role?: string }>
}

export default async function OrdersRedirect({ searchParams }: PageProps) {
  const { role } = await searchParams
  redirect(role ? `/settings/orders?role=${encodeURIComponent(role)}` : '/settings/orders')
}
