export default function NoStripePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm px-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Online payment unavailable</h1>
        <p className="text-gray-500">
          Online payment isn&apos;t set up for this invoice. Please contact the business directly to arrange payment.
        </p>
      </div>
    </div>
  )
}
