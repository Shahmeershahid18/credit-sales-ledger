import React from 'react';
import { Document, Page, StyleSheet, Svg, Rect, Path, Circle, Text, View } from '@react-pdf/renderer';
import type { PartyStatement } from '@/lib/types';
import { balanceLabel, formatBalance, formatDate, formatRs } from '@/lib/format';
import { statementDetails } from '@/lib/statement';

// The built-in Helvetica only covers Latin-1, so text sticks to plain characters:
// "-" instead of dashes, no arrows.

export type StatementPdfData = {
  ledgerName: string;
  party: { name: string; phone?: string | null; address?: string | null };
  statement: PartyStatement;
  generatedOn: string; // "07 Nov 2026"
};

const INK = '#18181b';
const INK_2 = '#52525b';
const MUTED = '#a1a1aa';
const LINE = '#e4e4e7';
const BRAND = '#059669';

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 36, fontFamily: 'Helvetica', fontSize: 9, color: INK },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandName: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginLeft: 7 },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 20, marginTop: 14 },
  period: { fontSize: 10.5, color: INK_2, marginTop: 4 },
  party: { alignItems: 'flex-end', maxWidth: 220 },
  partyName: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  partyLine: { fontSize: 8.5, color: INK_2, marginTop: 2, textAlign: 'right' },
  rule: { height: 3, backgroundColor: BRAND, borderRadius: 2, marginTop: 14, marginBottom: 16, width: 48 },

  tiles: { flexDirection: 'row', marginHorizontal: -4, marginBottom: 16 },
  tile: { flex: 1, marginHorizontal: 4, padding: 9, borderRadius: 6, borderWidth: 1, borderColor: LINE },
  tileStrong: { borderColor: INK },
  tileLabel: { fontSize: 7.5, color: INK_2 },
  tileValue: { fontFamily: 'Helvetica-Bold', fontSize: 11.5, marginTop: 4 },

  th: { flexDirection: 'row', backgroundColor: '#f4f4f5', borderRadius: 4, paddingVertical: 6, paddingHorizontal: 8 },
  thText: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: INK_2 },
  tr: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: LINE },
  trTotal: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8, backgroundColor: '#f4f4f5', borderRadius: 4, marginTop: 2 },
  cDate: { width: 62 },
  cDetails: { flex: 1, paddingRight: 8 },
  cNum: { width: 78, textAlign: 'right' },
  cBal: { width: 92, textAlign: 'right' },
  sub: { fontSize: 7.5, color: INK_2, marginTop: 1.5 },
  bold: { fontFamily: 'Helvetica-Bold' },

  summary: { marginTop: 16, padding: 10, borderRadius: 6 },
  note: { marginTop: 10, fontSize: 7.5, color: INK_2, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: MUTED, borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 6 },
});

function LogoMark() {
  return (
    <Svg viewBox="0 0 32 32" style={{ width: 20, height: 20 }}>
      <Rect width="32" height="32" rx="8" fill={BRAND} />
      <Path d="M9 10.5h14M9 16h10M9 21.5h6" stroke="#ffffff" strokeWidth={2.75} strokeLinecap="round" />
      <Circle cx="22" cy="21.5" r="2.25" fill="#a7f3d0" />
    </Svg>
  );
}

const money = (v: number) => (v > 0 ? formatRs(v) : '-');

export function StatementDocument({ ledgerName, party, statement, generatedOn }: StatementPdfData) {
  const label = balanceLabel(statement.closing);
  const period = `${formatDate(statement.from)} - ${formatDate(statement.to)}`;
  const summary =
    label === 'Receivable'
      ? `${party.name} owes ${formatRs(statement.closing)} as of ${formatDate(statement.to)}.`
      : label === 'Payable'
      ? `${formatRs(-statement.closing)} is payable to ${party.name} as of ${formatDate(statement.to)}.`
      : `Nothing is owed either way as of ${formatDate(statement.to)}.`;

  return (
    <Document title={`Statement - ${party.name} - ${period}`} author={ledgerName} creator="Credit Ledger">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <View style={s.brandRow}>
              <LogoMark />
              <Text style={s.brandName}>{ledgerName}</Text>
            </View>
            <Text style={s.title}>Account statement</Text>
            <Text style={s.period}>{period}</Text>
          </View>
          <View style={s.party}>
            <Text style={s.partyName}>{party.name}</Text>
            {party.phone ? <Text style={s.partyLine}>{party.phone}</Text> : null}
            {party.address ? <Text style={s.partyLine}>{party.address}</Text> : null}
          </View>
        </View>
        <View style={s.rule} />

        <View style={s.tiles}>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Opening balance</Text>
            <Text style={s.tileValue}>{formatBalance(statement.opening)}</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Total debit</Text>
            <Text style={s.tileValue}>{formatRs(statement.totalDebit)}</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Total credit</Text>
            <Text style={s.tileValue}>{formatRs(statement.totalCredit)}</Text>
          </View>
          <View style={[s.tile, s.tileStrong]}>
            <Text style={s.tileLabel}>{label === 'Settled' ? 'Closing balance' : `Closing (${label.toLowerCase()})`}</Text>
            <Text style={s.tileValue}>{formatBalance(statement.closing)}</Text>
          </View>
        </View>

        <View style={s.th} fixed>
          <Text style={[s.thText, s.cDate]}>Date</Text>
          <Text style={[s.thText, s.cDetails]}>Details</Text>
          <Text style={[s.thText, s.cNum]}>Debit</Text>
          <Text style={[s.thText, s.cNum]}>Credit</Text>
          <Text style={[s.thText, s.cBal]}>Balance</Text>
        </View>

        <View style={s.tr} wrap={false}>
          <Text style={s.cDate}>{formatDate(statement.from)}</Text>
          <Text style={[s.cDetails, s.bold]}>Opening balance</Text>
          <Text style={s.cNum} />
          <Text style={s.cNum} />
          <Text style={[s.cBal, s.bold]}>{formatBalance(statement.opening)}</Text>
        </View>

        {statement.rows.map((row) => (
          <View key={row.id} style={s.tr} wrap={false}>
            <Text style={s.cDate}>{formatDate(row.date)}</Text>
            <View style={s.cDetails}>
              <Text>{statementDetails(row)}</Text>
              {row.due_date ? <Text style={s.sub}>Due {formatDate(row.due_date)}</Text> : null}
              {row.notes ? <Text style={s.sub}>{row.notes}</Text> : null}
            </View>
            <Text style={s.cNum}>{money(row.debit)}</Text>
            <Text style={s.cNum}>{money(row.credit)}</Text>
            <Text style={[s.cBal, s.bold]}>{formatBalance(row.balance)}</Text>
          </View>
        ))}

        {statement.rows.length === 0 && (
          <View style={s.tr}>
            <Text style={{ flex: 1, textAlign: 'center', color: MUTED }}>No entries in this period.</Text>
          </View>
        )}

        <View style={s.trTotal} wrap={false}>
          <Text style={[s.cDate, s.bold]}>Closing</Text>
          <Text style={s.cDetails} />
          <Text style={[s.cNum, s.bold]}>{formatRs(statement.totalDebit)}</Text>
          <Text style={[s.cNum, s.bold]}>{formatRs(statement.totalCredit)}</Text>
          <Text style={[s.cBal, s.bold]}>{formatBalance(statement.closing)}</Text>
        </View>

        <View
          style={[
            s.summary,
            { backgroundColor: label === 'Receivable' ? '#ecfdf5' : label === 'Payable' ? '#fff1f2' : '#f4f4f5' },
          ]}
          wrap={false}
        >
          <Text style={[s.bold, { color: label === 'Receivable' ? '#065f46' : label === 'Payable' ? '#9f1239' : INK }]}>{summary}</Text>
        </View>
        <Text style={s.note}>
          Debit: sales, and payments made to the party. Credit: purchases, and payments received from the party. Dr balance =
          receivable, Cr balance = payable.
        </Text>

        <View style={s.footer} fixed>
          <Text>
            {party.name} - statement {period} - generated {generatedOn}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
