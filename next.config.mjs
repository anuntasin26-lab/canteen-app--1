/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Viewport",
            value: "width=device-width, initial-scale=1, maximum-scale=1",
          },
        ],
      },
    ];
  },
};

export default nextConfig;