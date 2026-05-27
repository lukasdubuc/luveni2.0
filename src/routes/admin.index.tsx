import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/')({
  component: AdminIndex,
})

function AdminIndex() {
  return (
    <div>
      {/* Admin content here */}
    </div>
  )
}