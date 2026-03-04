export default function AlreadyPaidPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm px-6">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Already paid</h1>
        <p className="text-gray-500">This invoice has already been paid. No further action is needed.</p>
      </div>
    </div>
  )
}
