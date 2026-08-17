import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { supabaseAdmin } from '@/lib/serverSupabase';
import { currentUser, can } from '@/lib/auth';

export const runtime = 'nodejs';

const money = (n: unknown) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function settings(sb: any) {
  const { data, error } = await sb
    .from('business_settings')
    .select('key,value_json')
    .in('key', ['business_name', 'legal_name', 'gstin', 'address', 'state', 'pincode', 'phone', 'email', 'terms']);
  if (error) throw error;
  const out: Record<string, any> = {};
  for (const row of data || []) out[row.key] = row.value_json;
  return out;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    const internal = req.headers.get('x-internal-invoice') === process.env.APP_SESSION_SECRET;

    if ((!user || !can(user.role, 'sales')) && !internal) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const sb = supabaseAdmin();

    const [{ data: sale, error: saleError }, { data: items, error: itemsError }, cfg] =
      await Promise.all([
        sb.from('sales').select('*,customers(name,mobile,town)').eq('id', id).single(),
        sb.from('sale_items').select('*,products(product_name,brand,model,serial_no)').eq('sale_id', id).order('id'),
        settings(sb),
      ]);

    if (saleError) throw saleError;
    if (itemsError) throw itemsError;

    if (!cfg.gstin) {
      return NextResponse.json(
        { error: 'GSTIN is not configured in Settings. Add the business GSTIN before issuing GST invoices.' },
        { status: 400 }
      );
    }

    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    );

    doc.fontSize(18).text(cfg.business_name || cfg.legal_name || 'Latur Liquidation OS');
    doc.fontSize(9).text(cfg.address || '');
    doc.text(`GSTIN: ${cfg.gstin} | State: ${cfg.state || 'Maharashtra'} | PIN: ${cfg.pincode || ''}`);
    if (cfg.phone) doc.text(`Phone: ${cfg.phone}`);
    if (cfg.email) doc.text(`Email: ${cfg.email}`);
    doc.moveDown();
    doc.fontSize(16).text('TAX INVOICE', { align: 'center' });
    doc.moveDown();
    doc
      .fontSize(10)
      .text(`Invoice No: ${sale.invoice_no}`)
      .text(`Invoice Date: ${new Date(sale.sale_date).toLocaleDateString('en-IN')}`);
    doc.moveDown();

    const customer = sale.customers || {};
    doc
      .fontSize(10)
      .text(`Bill To: ${sale.billing_name || customer.name || 'Customer'}`)
      .text(`Mobile: ${customer.mobile || ''}`)
      .text(`Address: ${sale.billing_address || customer.town || ''}`)
      .text(`GSTIN/UIN: ${sale.billing_gstin || 'Unregistered'}`)
      .text(`Place of Supply: ${sale.place_of_supply || cfg.state || 'Maharashtra'}`);
    doc.moveDown();

    let y = doc.y;
    doc
      .fontSize(7.5)
      .text('Description', 42, y, { width: 155 })
      .text('HSN', 197, y, { width: 42 })
      .text('Qty', 239, y, { width: 30 })
      .text('Rate', 269, y, { width: 60 })
      .text('Taxable', 329, y, { width: 65 })
      .text('CGST', 394, y, { width: 48 })
      .text('SGST', 442, y, { width: 48 })
      .text('IGST', 490, y, { width: 48 })
      .text('Total', 538, y, { width: 55 });
    y += 18;
    doc.moveTo(42, y).lineTo(593, y).stroke();

    let taxableTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    for (const item of items || []) {
      const product = item.products || {};
      const taxable = Number(item.taxable_value || item.line_total || 0);
      const cgst = Number(item.cgst || 0);
      const sgst = Number(item.sgst || 0);
      const igst = Number(item.igst || 0);
      const line = taxable + cgst + sgst + igst;

      taxableTotal += taxable;
      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;

      doc
        .fontSize(7.5)
        .text(`${product.product_name || 'Product'}${product.brand ? ` - ${product.brand}` : ''}`, 42, y, { width: 155 })
        .text(item.hsn_code || '', 197, y, { width: 42 })
        .text(String(item.qty || 1), 239, y, { width: 30 })
        .text(money(item.unit_price), 269, y, { width: 60 })
        .text(money(taxable), 329, y, { width: 65 })
        .text(money(cgst), 394, y, { width: 48 })
        .text(money(sgst), 442, y, { width: 48 })
        .text(money(igst), 490, y, { width: 48 })
        .text(money(line), 538, y, { width: 55 });

      y += 18;
      if (y > 700) {
        doc.addPage();
        y = 60;
      }
    }

    const total = taxableTotal + cgstTotal + sgstTotal + igstTotal;
    doc.moveDown(2);
    doc.fontSize(9).text(`Taxable Value: ${money(sale.subtotal || taxableTotal)}`, { align: 'right' });
    doc.text(`CGST: ${money(cgstTotal)}`, { align: 'right' });
    doc.text(`SGST: ${money(sgstTotal)}`, { align: 'right' });
    doc.text(`IGST: ${money(igstTotal)}`, { align: 'right' });
    doc.fontSize(13).text(`Grand Total: ${money(sale.total || total)}`, { align: 'right' });
    doc.moveDown();
    doc.fontSize(9).text(`Payment: ${sale.payment_mode || '—'} | Status: ${sale.payment_status || '—'}`);
    doc.text('Reverse Charge: No');
    doc.moveDown(2);
    doc.text(cfg.terms || 'Goods sold subject to stated warranty and return terms.');
    doc.moveDown(2);
    doc.text('For the supplier');
    doc.text('Authorised Signatory');
    doc.end();

    const pdf = await done;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${sale.invoice_no || 'invoice'}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Invoice generation failed' }, { status: 500 });
  }
}
