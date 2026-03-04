/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['nonneutrally-boltless-deidre.ngrok-free.dev'],
  serverExternalPackages: ['pdfkit'],
}

export default nextConfig
