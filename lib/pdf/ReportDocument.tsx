import React from 'react';
import { Document, Page, StyleSheet, Svg, Rect, Path, Circle, Text, View } from '@react-pdf/renderer';
import type { MonthlyReport } from '@/lib/types';
import { formatMonth, formatMonthShort, formatRs } from '@/lib/format';

// The built-in Helvetica only covers Latin-1, so text sticks to plain characters:
// "-" instead of the minus sign, no arrows.

export type ReportPdfData = {
  side: 'customer' | 'vendor';
  yearly: boolean;
  title: string; // "Sales report"
  periodLabel: string; // "October 2026" or "Year 2026 (to 4 Nov 2026)"
  ledgerName: string;
  generatedOn: string; // "04 Nov 2026"
  report: MonthlyReport;
  trend: { month: string; billed: number; cash: number }[]; // oldest first
  highlightMonth?: string; // month of a monthly report, picked out in the trend
  labels: {
    one: string; // "Customer"
    many: string; // "customers"
    entries: string; // "sales"
    billed: string; // "Sold"
    billedLong: string; // "Material sold"
    cash: string; // "Received"
    cashLong: string; // "Payment received"
    remaining: string; // "Balance remaining"
    net: string; // "Net (sold - received)"
  };
};

// Validated categorical pair (slots 1 and 3): what was billed, and the cash that moved
const BILLED = '#2a78d6';
const CASH = '#1baf7a';
const INK = '#18181b';
const INK_2 = '#52525b';
const MUTED = '#a1a1aa';
const LINE = '#e4e4e7';
const GRID = '#f0f0f1';
const BRAND = '#059669';

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 36, fontFamily: 'Helvetica', fontSize: 9, color: INK },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandName: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginLeft: 7 },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 22, marginTop: 14 },
  period: { fontSize: 11, color: INK_2, marginTop: 4 },
  meta: { alignItems: 'flex-end', fontSize: 8.5, color: INK_2, lineHeight: 1.5 },
  metaStrong: { fontFamily: 'Helvetica-Bold', color: INK },
  rule: { height: 3, backgroundColor: BRAND, borderRadius: 2, marginTop: 14, marginBottom: 18, width: 48 },

  tiles: { flexDirection: 'row', marginHorizontal: -4 },
  tile: { flex: 1, marginHorizontal: 4, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: LINE },
  tileLabel: { fontSize: 8, color: INK_2 },
  tileValue: { fontFamily: 'Helvetica-Bold', fontSize: 13, marginTop: 5 },
  tileSub: { fontSize: 7.5, color: MUTED, marginTop: 3 },

  section: { marginTop: 20 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  h2: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  hint: { fontSize: 8, color: INK_2, marginTop: 2 },
  legend: { flexDirection: 'row', alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  swatch: { width: 7, height: 7, borderRadius: 1.5, marginRight: 4 },
  legendText: { fontSize: 8, color: INK_2 },

  card: { borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 12 },
  highlights: { backgroundColor: '#f8faf9', borderRadius: 6, padding: 12, borderLeftWidth: 3, borderLeftColor: BRAND },
  bulletRow: { flexDirection: 'row', marginTop: 3 },
  bullet: { width: 10, color: BRAND, fontFamily: 'Helvetica-Bold' },
  bulletText: { flex: 1, fontSize: 9, color: INK, lineHeight: 1.4 },

  th: { flexDirection: 'row', backgroundColor: '#f4f4f5', borderRadius: 4, paddingVertical: 6, paddingHorizontal: 8 },
  thText: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: INK_2 },
  tr: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: LINE },
  trTotal: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8, backgroundColor: '#f4f4f5', borderRadius: 4, marginTop: 2 },
  cName: { flex: 2.2 },
  cNum: { flex: 1.3, textAlign: 'right' },
  bold: { fontFamily: 'Helvetica-Bold' },

  empty: { color: MUTED, textAlign: 'center', paddingVertical: 24 },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: MUTED, borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 6 },
});

/** Short axis amounts: 800k, 1.5M */
function compact(v: number): string {
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${+(v / 1000).toFixed(v >= 100_000 ? 0 : 1)}k`;
  return String(Math.round(v));
}

/** A round axis maximum and step with about four gridlines */
function niceScale(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 1 };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) ?? 10 * mag;
  return { top: Math.ceil(max / step) * step, step };
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function LogoMark() {
  return (
    <Svg viewBox="0 0 32 32" style={{ width: 20, height: 20 }}>
      <Rect width="32" height="32" rx="8" fill={BRAND} />
      <Path d="M9 10.5h14M9 16h10M9 21.5h6" stroke="#ffffff" strokeWidth={2.75} strokeLinecap="round" />
      <Circle cx="22" cy="21.5" r="2.25" fill="#a7f3d0" />
    </Svg>
  );
}

function Legend({ billed, cash }: { billed: string; cash: string }) {
  return (
    <View style={s.legend}>
      {[
        { label: billed, color: BILLED },
        { label: cash, color: CASH },
      ].map((item) => (
        <View key={item.label} style={s.legendItem}>
          <View style={[s.swatch, { backgroundColor: item.color }]} />
          <Text style={s.legendText}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Grouped columns per month: billed and cash side by side */
function TrendChart({ data, highlight }: { data: ReportPdfData['trend']; highlight?: string }) {
  const height = 140;
  const axisWidth = 34;
  const { top, step } = niceScale(Math.max(0, ...data.flatMap((d) => [d.billed, d.cash])));
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  const barWidth = data.length > 8 ? 9 : 14;
  const h = (v: number) => (v > 0 ? Math.max(1.5, (v / top) * height) : 0);

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        {/* Y axis labels */}
        <View style={{ width: axisWidth, height, position: 'relative' }}>
          {ticks.map((t) => (
            <Text key={t} style={{ position: 'absolute', right: 6, bottom: (t / top) * height - 3.5, fontSize: 7, color: MUTED }}>
              {compact(t)}
            </Text>
          ))}
        </View>
        {/* Plot */}
        <View style={{ flex: 1, height, position: 'relative' }}>
          {ticks.map((t) => (
            <View
              key={t}
              style={{ position: 'absolute', left: 0, right: 0, bottom: (t / top) * height, height: t === 0 ? 0.75 : 0.5, backgroundColor: t === 0 ? LINE : GRID }}
            />
          ))}
          <View style={{ flexDirection: 'row', height, alignItems: 'flex-end' }}>
            {data.map((d) => (
              <View
                key={d.month}
                style={{
                  flex: 1,
                  height,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'flex-end',
                  backgroundColor: d.month === highlight ? '#f4f4f5' : undefined,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                }}
              >
                <View style={{ width: barWidth, height: h(d.billed), backgroundColor: BILLED, borderTopLeftRadius: 2.5, borderTopRightRadius: 2.5 }} />
                <View style={{ width: 2 }} />
                <View style={{ width: barWidth, height: h(d.cash), backgroundColor: CASH, borderTopLeftRadius: 2.5, borderTopRightRadius: 2.5 }} />
              </View>
            ))}
          </View>
        </View>
      </View>
      {/* X axis labels */}
      <View style={{ flexDirection: 'row', marginLeft: axisWidth, marginTop: 5 }}>
        {data.map((d) => (
          <Text
            key={d.month}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 7.5,
              color: d.month === highlight ? INK : INK_2,
              fontFamily: d.month === highlight ? 'Helvetica-Bold' : 'Helvetica',
            }}
          >
            {formatMonthShort(d.month)}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Horizontal bars for the biggest contacts, billed above cash, values at the tips */
function TopContacts({ rows }: { rows: MonthlyReport['customerBreakdown'] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.materialSold, r.paymentReceived]));
  const track = 300; // bar track width in points
  const bar = (value: number, color: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 9 }}>
      {value > 0 && <View style={{ width: Math.max(2, (value / max) * track), height: 7, backgroundColor: color, borderTopRightRadius: 2.5, borderBottomRightRadius: 2.5 }} />}
      <Text style={{ fontSize: 7.5, color: value > 0 ? INK_2 : MUTED, marginLeft: 4 }}>{value > 0 ? formatRs(value) : '—'}</Text>
    </View>
  );

  return (
    <View>
      {rows.map((r, i) => (
        <View key={r.customerId} style={{ flexDirection: 'row', alignItems: 'center', marginTop: i === 0 ? 0 : 7 }} wrap={false}>
          <Text style={{ width: 120, fontSize: 8.5, paddingRight: 8 }}>{r.customerName}</Text>
          <View style={{ flex: 1, borderLeftWidth: 0.75, borderLeftColor: LINE }}>
            {bar(r.materialSold, BILLED)}
            <View style={{ height: 1.5 }} />
            {bar(r.paymentReceived, CASH)}
          </View>
        </View>
      ))}
    </View>
  );
}

const amountCell = (value: number) => (
  <Text style={[s.cNum, { color: value ? INK : MUTED }]}>{value ? formatRs(value) : '—'}</Text>
);

function TableRow({ row, index }: { row: MonthlyReport['customerBreakdown'][number]; index: number }) {
  return (
    <View style={[s.tr, index % 2 === 1 ? { backgroundColor: '#fafafa' } : {}]} wrap={false}>
      <Text style={s.cName}>{row.customerName}</Text>
      {amountCell(row.materialSold)}
      {amountCell(row.paymentReceived)}
      {amountCell(row.paymentDue)}
      <Text style={[s.cNum, s.bold]}>{formatRs(row.monthBalance)}</Text>
    </View>
  );
}

export function ReportDocument(d: ReportPdfData) {
  const { report, labels } = d;
  const rows = report.customerBreakdown;
  const net = report.materialSold - report.paymentReceived;
  const periodWord = d.yearly ? 'year' : 'month';

  // Plain-language highlights worked out from the figures
  const highlights: string[] = [];
  if (report.materialSold > 0 || report.paymentReceived > 0) {
    highlights.push(
      `${labels.billedLong} ${formatRs(report.materialSold)}; ${labels.cashLong.toLowerCase()} ${formatRs(report.paymentReceived)}` +
        (report.materialSold > 0 ? ` (${pct(report.paymentReceived, report.materialSold)}% of the amount ${labels.billed.toLowerCase()}).` : '.')
    );
  }
  const top = [...rows].sort((a, b) => b.materialSold - a.materialSold)[0];
  if (top && top.materialSold > 0) {
    highlights.push(
      `Largest ${labels.one.toLowerCase()}: ${top.customerName}, ${formatRs(top.materialSold)} (${pct(top.materialSold, report.materialSold)}% of the ${periodWord}).`
    );
  }
  if (d.yearly) {
    const best = [...d.trend].sort((a, b) => b.billed - a.billed)[0];
    if (best && best.billed > 0) highlights.push(`Busiest month: ${formatMonth(best.month)}, ${formatRs(best.billed)} ${labels.billed.toLowerCase()}.`);
  }
  if (report.paymentDue > 0) highlights.push(`${formatRs(report.paymentDue)} falls due during this ${periodWord}.`);
  highlights.push(`${labels.remaining} across all ${labels.many} today: ${formatRs(report.balanceRemaining)}.`);

  const topRows = [...rows]
    .sort((a, b) => b.materialSold + b.paymentReceived - (a.materialSold + a.paymentReceived))
    .slice(0, 8);
  const hasTrend = d.trend.some((t) => t.billed > 0 || t.cash > 0);

  return (
    <Document title={`${d.title} - ${d.periodLabel}`} author="Credit Ledger" creator="Credit Ledger" subject={d.ledgerName}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <View style={s.brandRow}>
              <LogoMark />
              <Text style={s.brandName}>Credit Ledger</Text>
            </View>
            <Text style={s.title}>{d.title}</Text>
            <Text style={s.period}>{d.periodLabel}</Text>
          </View>
          <View style={s.meta}>
            <Text>Ledger</Text>
            <Text style={s.metaStrong}>{d.ledgerName}</Text>
            <Text style={{ marginTop: 4 }}>Generated</Text>
            <Text style={s.metaStrong}>{d.generatedOn}</Text>
          </View>
        </View>
        <View style={s.rule} />

        {/* Key figures */}
        <View style={s.tiles}>
          <View style={[s.tile, { borderTopWidth: 3, borderTopColor: BILLED }]}>
            <Text style={s.tileLabel}>{labels.billedLong}</Text>
            <Text style={s.tileValue}>{formatRs(report.materialSold)}</Text>
            <Text style={s.tileSub}>In this {periodWord}</Text>
          </View>
          <View style={[s.tile, { borderTopWidth: 3, borderTopColor: CASH }]}>
            <Text style={s.tileLabel}>{labels.cashLong}</Text>
            <Text style={s.tileValue}>{formatRs(report.paymentReceived)}</Text>
            <Text style={s.tileSub}>In this {periodWord}</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Payment due</Text>
            <Text style={s.tileValue}>{formatRs(report.paymentDue)}</Text>
            <Text style={s.tileSub}>Falling due this {periodWord}</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>{labels.remaining}</Text>
            <Text style={s.tileValue}>{formatRs(report.balanceRemaining)}</Text>
            <Text style={s.tileSub}>All {labels.many}, as of today</Text>
          </View>
        </View>

        {/* Highlights */}
        <View style={[s.section, s.highlights]} wrap={false}>
          <Text style={s.h2}>Highlights</Text>
          <View style={{ marginTop: 4 }}>
            {highlights.map((h) => (
              <View key={h} style={s.bulletRow}>
                <Text style={s.bullet}>•</Text>
                <Text style={s.bulletText}>{h}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Trend */}
        <View style={s.section} wrap={false}>
          <View style={s.sectionHead}>
            <View>
              <Text style={s.h2}>{d.yearly ? 'Month by month' : `Last ${d.trend.length} months`}</Text>
              <Text style={s.hint}>{d.yearly ? `Every month of the year` : `Ending with the month of this report`}</Text>
            </View>
            <Legend billed={labels.billed} cash={labels.cash} />
          </View>
          <View style={s.card}>{hasTrend ? <TrendChart data={d.trend} highlight={d.highlightMonth} /> : <Text style={s.empty}>No activity in these months</Text>}</View>
        </View>

        {/* Top contacts */}
        {topRows.length > 0 && (
          <View style={s.section} wrap={false}>
            <View style={s.sectionHead}>
              <View>
                <Text style={s.h2}>Top {labels.many}</Text>
                <Text style={s.hint}>
                  {rows.length > topRows.length ? `The ${topRows.length} largest of ${rows.length}` : `All ${rows.length} with activity`} in this {periodWord}
                </Text>
              </View>
              <Legend billed={labels.billed} cash={labels.cash} />
            </View>
            <View style={s.card}>
              <TopContacts rows={topRows} />
            </View>
          </View>
        )}

        {/* Full breakdown. The heading, column titles and first row stay together, so the
            heading never sits alone at the foot of a page. */}
        <View style={s.section}>
          <View wrap={false}>
            <View style={s.sectionHead}>
              <View>
                <Text style={s.h2}>By {labels.one.toLowerCase()}</Text>
                <Text style={s.hint}>
                  {rows.length} {rows.length === 1 ? labels.one.toLowerCase() : labels.many} with activity in this {periodWord}
                </Text>
              </View>
            </View>
            {rows.length === 0 ? (
              <View style={s.card}>
                <Text style={s.empty}>
                  No {labels.entries}, payments or due dates in this {periodWord}.
                </Text>
              </View>
            ) : (
              <>
                <View style={s.th}>
                  <Text style={[s.thText, s.cName]}>{labels.one}</Text>
                  <Text style={[s.thText, s.cNum]}>{labels.billed}</Text>
                  <Text style={[s.thText, s.cNum]}>{labels.cash}</Text>
                  <Text style={[s.thText, s.cNum]}>Due</Text>
                  <Text style={[s.thText, s.cNum]}>{labels.net}</Text>
                </View>
                <TableRow row={rows[0]} index={0} />
              </>
            )}
          </View>
          {rows.slice(1).map((r, i) => (
            <TableRow key={r.customerId} row={r} index={i + 1} />
          ))}
          {rows.length > 0 && (
            <View style={s.trTotal} wrap={false}>
              <Text style={[s.cName, s.bold]}>Total</Text>
              <Text style={[s.cNum, s.bold]}>{formatRs(report.materialSold)}</Text>
              <Text style={[s.cNum, s.bold]}>{formatRs(report.paymentReceived)}</Text>
              <Text style={[s.cNum, s.bold]}>{formatRs(report.paymentDue)}</Text>
              <Text style={[s.cNum, s.bold]}>{formatRs(net)}</Text>
            </View>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text>
            Credit Ledger · {d.title} · {d.periodLabel}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
