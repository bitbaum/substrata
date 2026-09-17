import { NextRequest } from 'next/server';
import { GRAPH_KINDS, neighbors, type GraphKind } from '@/lib/graph';

// The kinds the graph serves, not a second copy of them: this list had already
// fallen behind by one — `policy` is a node kind now.

export function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get('kind') as GraphKind | null;
  const id = request.nextUrl.searchParams.get('id');
  if (!kind || !id || !GRAPH_KINDS.includes(kind)) {
    return Response.json({ error: 'Pass kind and id.' }, { status: 400 });
  }
  return Response.json({ data: neighbors(kind, id) });
}
