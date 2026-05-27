import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/offer/$slug')({
  component: OfferSlug,
})

function OfferSlug() {
  return (
    <>
      <div className="flex items-center gap-2">
        {/* Content here */}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
      </div>
    </>
  )
}