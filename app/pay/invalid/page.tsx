export default function InvalidPayLinkPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm px-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Link not found</h1>
        <p className="text-gray-500">This payment link is invalid or has been removed.</p>
      </div>
    </div>
  )
}
