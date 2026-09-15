import { chainDiagram } from '@/lib/chain-diagram';
export function GET(request: Request) {
  const url = new URL(request.url);
  const svg = chainDiagram(url.searchParams.get('slug') ?? '');
  if (!svg) return new Response('Unknown bottleneck', { status: 404 });
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'Cache-Control': 'public, max-age=300',
      ...(url.searchParams.has('download')
        ? { 'Content-Disposition': 'attachment; filename="substrata-chain.svg"' }
        : {}),
    },
  });
}
