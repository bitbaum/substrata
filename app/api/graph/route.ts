import { NextRequest } from 'next/server';
import { neighbors, type GraphKind } from '@/lib/graph';

const KINDS: GraphKind[] = ['country', 'company', 'bottleneck', 'science', 'capital'];

export function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get('kind') as GraphKind | null;
  const id = request.nextUrl.searchParams.get('id');
  if (!kind || !id || !KINDS.includes(kind)) {
    return Response.json({ error: 'Pass kind and id.' }, { status: 400 });
  }
  return Response.json({ data: neighbors(kind, id) });
}
