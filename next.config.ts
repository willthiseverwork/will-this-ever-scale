import type { NextConfig } from 'next';
const nextConfig: NextConfig = { reactStrictMode: true, async rewrites(){return [{source:'/api/status',destination:'/api/sandbox/analyze'}];} };
export default nextConfig;
