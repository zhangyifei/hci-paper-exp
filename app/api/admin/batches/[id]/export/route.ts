import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthorized } from '@/lib/admin-auth'
import { loadBatchExportData } from '@/lib/batch-export/load-batch'
import { buildBatchWorkbook } from '@/lib/batch-export/build-workbook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const fileSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'batch'

/** Raw-data Excel export for one batch (responses, scores, event log, disposition, codebook). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'Invalid batch id' }, { status: 400 })
  }

  try {
    const data = await loadBatchExportData(id)
    if (!data) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

    const bytes = await buildBatchWorkbook(data)
    const filename = `${fileSlug(data.batch.name)}-raw-data-${new Date().toISOString().slice(0, 10)}.xlsx`
    return new Response(bytes, {
      headers: {
        'Content-Type': XLSX_MIME,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[api/admin/batches/:id/export]', err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
