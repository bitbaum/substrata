import { researchExport, bottlenecksCsv } from '@/lib/research-export';
export function GET(request: Request) {
  const csv = new URL(request.url).searchParams.get('format') === 'csv';
  return new Response(csv ? bottlenecksCsv() : JSON.stringify(researchExport(), null, 2), {
    headers: {
      'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json',
      'Content-Disposition': `attachment; filename="substrata-research.${csv ? 'csv' : 'json'}"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
