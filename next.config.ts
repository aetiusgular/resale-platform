import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // Silence the workspace root warning from multiple lockfiles
  outputFileTracingRoot: path.join(__dirname),
}

export default nextConfig
