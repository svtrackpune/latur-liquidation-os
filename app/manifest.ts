import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Latur Liquidation OS',
    short_name: 'Latur Liquidation',
    description: 'Procurement, inventory, warehouse, sales and AI operations system',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#0f172a',
    orientation: 'portrait-primary',
    categories: ['business', 'productivity', 'shopping'],
  };
}
