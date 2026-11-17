import React from 'react';
import { notFound, redirect } from 'next/navigation';
import {
  getCreditSaleById,
  getCustomerById,
  getCustomerCards,
  getCustomerSaleOptions,
  getLedger,
  getMaterials,
  getOpeningBalance,
  getParties,
  getPartyLedger,
  getPaymentById,
  getReturnById,
} from '@/lib/queries';
import { ContactKind, SIDES } from '@/lib/contacts';
import { Customer } from '@/lib/types';
import { CustomerForm } from '@/components/CustomerForm';
import { MergeParty } from '@/components/MergeParty';
import { SaleForm } from '@/components/SaleForm';
import { PaymentForm } from '@/components/PaymentForm';
import { ReturnForm } from '@/components/ReturnForm';
import { PageHeader, cardClass } from '@/components/ui';

// Form pages shared by customers and vendors. With an `id` they are opened from one
// contact's ledger; without, the contact is picked in the form.

function FormPage({ title, description, backHref, children }: { title: string; description?: string; backHref: string; children: React.ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title={title} description={description} backHref={backHref} />
      <div className={`${cardClass} p-5 sm:p-6`}>{children}</div>
    </div>
  );
}

/** /customers/new, /vendors/new */
export function NewContactView({ kind }: { kind: ContactKind }) {
  const terms = SIDES[kind];
  return (
    <FormPage title={`New ${terms.one}`} backHref={terms.base}>
      <CustomerForm kind={kind} cancelHref={terms.base} />
    </FormPage>
  );
}

/** /customers/[id]/edit, /vendors/[id]/edit */
export async function EditContactView({ kind, id }: { kind: ContactKind; id: string }) {
  const terms = SIDES[kind];
  const contact = await getCustomerById(id, kind);
  if (!contact) notFound();

  const href = `${terms.base}/${id}`;
  const [parties, opening] = await Promise.all([getParties(), getOpeningBalance(id)]);
  const others = parties.filter((p) => p.id !== id);
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title={`Edit ${terms.one}`} description={contact.name} backHref={href} />
      <div className={`${cardClass} p-5 sm:p-6`}>
        <CustomerForm kind={kind} customer={contact} opening={opening} cancelHref={href} />
      </div>
      {others.length > 0 && (
        <div className={`${cardClass} p-5 sm:p-6`}>
          <MergeParty
            party={{ id: contact.id, name: contact.name }}
            options={others.map((p) => ({ id: p.id, name: p.name, roles: roleLabel(p) }))}
            redirectTo={href}
          />
        </div>
      )}
    </div>
  );
}

function roleLabel(p: Customer) {
  return p.is_customer && p.is_vendor ? 'Customer and vendor' : p.is_vendor ? 'Vendor' : 'Customer';
}

/** /sales/new, /purchases/new and /[side]/[id]/sale|purchase/new */
export async function NewEntryView({ kind, id }: { kind: ContactKind; id?: string }) {
  const terms = SIDES[kind];

  if (id) {
    const [contact, { materials, available }] = await Promise.all([getCustomerById(id, kind), getMaterials()]);
    if (!contact) notFound();
    const href = `${terms.base}/${id}`;
    return (
      <FormPage title={terms.newEntryTitle} description={contact.name} backHref={href}>
        <SaleForm
          kind={kind}
          customers={[{ id: contact.id, name: contact.name }]}
          materials={materials}
          materialsAvailable={available}
          preselectedCustomerId={id}
          cancelHref={href}
        />
      </FormPage>
    );
  }

  const [parties, { materials, available }] = await Promise.all([getParties(), getMaterials()]);
  return (
    <FormPage title={terms.newEntryTitle} backHref="/dashboard">
      <SaleForm kind={kind} customers={partyOptions(kind, parties)} materials={materials} materialsAvailable={available} cancelHref="/dashboard" />
    </FormPage>
  );
}

/** Any party can be picked for a sale or purchase: this side's first, then the others, which take on this role */
function partyOptions(kind: ContactKind, parties: Customer[]) {
  const terms = SIDES[kind];
  const hasRole = (c: Customer) => (kind === 'vendor' ? c.is_vendor : c.is_customer);
  const ordered = [...parties.filter(hasRole), ...parties.filter((c) => !hasRole(c))];
  const otherLabel = `${SIDES[kind === 'vendor' ? 'customer' : 'vendor'].One} · becomes a ${terms.one} too`;
  return ordered.map((c) => ({ id: c.id, name: c.name, phone: hasRole(c) ? c.phone : otherLabel }));
}

/** /customers/[id]/sale/[entryId]/edit, /vendors/[id]/purchase/[entryId]/edit */
export async function EditEntryView({ kind, id, entryId }: { kind: ContactKind; id: string; entryId: string }) {
  const terms = SIDES[kind];
  const [contact, entry] = await Promise.all([getCustomerById(id, kind), getCreditSaleById(kind, id, entryId)]);
  if (!contact || !entry) notFound();
  // The opening balance is changed on the party form
  if (entry.is_opening) redirect(`${terms.base}/${id}/edit#opening`);

  const [parties, { materials, available }, ledger] = await Promise.all([getParties(), getMaterials(), getPartyLedger(id)]);
  const href = `${terms.base}/${id}`;
  const linked = ledger.rows.find((r) => r.id === entryId)?.linked ?? 0;
  return (
    <FormPage title={`Edit ${terms.entry}`} description={contact.name} backHref={href}>
      <SaleForm
        kind={kind}
        customers={partyOptions(kind, parties)}
        materials={materials}
        materialsAvailable={available}
        cancelHref={href}
        entry={entry}
        linkedPayments={linked}
      />
    </FormPage>
  );
}

/** /customers/[id]/payment/[paymentId]/edit, /vendors/[id]/payment/[paymentId]/edit */
export async function EditPaymentView({ kind, id, paymentId }: { kind: ContactKind; id: string; paymentId: string }) {
  const terms = SIDES[kind];
  const [contact, entry] = await Promise.all([getCustomerById(id, kind), getPaymentById(kind, id, paymentId)]);
  if (!contact || !entry || entry.method === 'adjustment') notFound();
  if (entry.is_opening) redirect(`${terms.base}/${id}/edit#opening`);
  if (entry.method === 'return') redirect(`${terms.base}/${id}/return/${paymentId}/edit`);

  const [contacts, sales] = await Promise.all([getCustomerCards(kind), getCustomerSaleOptions(id, kind, paymentId)]);
  const href = `${terms.base}/${id}`;
  return (
    <FormPage title={kind === 'vendor' ? 'Edit payment made' : 'Edit payment received'} description={contact.name} backHref={href}>
      <PaymentForm
        kind={kind}
        customers={contacts.map((c) => ({ id: c.customer_id, name: c.name, outstanding: c.outstanding, overdue: c.overdue }))}
        initialSales={sales}
        cancelHref={href}
        entry={entry}
      />
    </FormPage>
  );
}

/** /payments/new, /vendor-payments/new and /[side]/[id]/payment/new */
export async function NewPaymentView({ kind, id }: { kind: ContactKind; id?: string }) {
  const terms = SIDES[kind];

  if (id) {
    const contact = await getCustomerById(id, kind);
    if (!contact) notFound();
    const [ledger, sales] = await Promise.all([getLedger(id, kind), getCustomerSaleOptions(id, kind)]);
    const href = `${terms.base}/${id}`;
    return (
      <FormPage title={terms.paymentTitle} description={contact.name} backHref={href}>
        <PaymentForm
          kind={kind}
          customers={[{ id: contact.id, name: contact.name, outstanding: ledger.outstanding, overdue: ledger.overdue }]}
          preselectedCustomerId={id}
          initialSales={sales}
          cancelHref={href}
        />
      </FormPage>
    );
  }

  const contacts = await getCustomerCards(kind);
  return (
    <FormPage title={terms.paymentTitle} backHref="/dashboard">
      <PaymentForm
        kind={kind}
        customers={contacts.map((c) => ({ id: c.customer_id, name: c.name, outstanding: c.outstanding, overdue: c.overdue }))}
        cancelHref="/dashboard"
      />
    </FormPage>
  );
}

const RETURN_TITLES = { customer: 'Customer return', vendor: 'Vendor return' } as const;

/** /returns/new?side=…, /customers/[id]/return/new, /vendors/[id]/return/new */
export async function NewReturnView({ kind, id, backHref = '/returns' }: { kind: ContactKind; id?: string; backHref?: string }) {
  const terms = SIDES[kind];

  if (id) {
    const contact = await getCustomerById(id, kind);
    if (!contact) notFound();
    const [ledger, bills] = await Promise.all([getLedger(id, kind), getCustomerSaleOptions(id, kind)]);
    const href = `${terms.base}/${id}`;
    return (
      <FormPage title={RETURN_TITLES[kind]} description={contact.name} backHref={href}>
        <ReturnForm
          kind={kind}
          customers={[{ id: contact.id, name: contact.name, outstanding: ledger.outstanding, overdue: ledger.overdue }]}
          preselectedCustomerId={id}
          initialSales={bills}
          cancelHref={href}
        />
      </FormPage>
    );
  }

  const contacts = await getCustomerCards(kind);
  return (
    <FormPage title={RETURN_TITLES[kind]} backHref={backHref}>
      <ReturnForm
        kind={kind}
        customers={contacts.map((c) => ({ id: c.customer_id, name: c.name, outstanding: c.outstanding, overdue: c.overdue }))}
        cancelHref={backHref}
      />
    </FormPage>
  );
}

/** /customers/[id]/return/[returnId]/edit, /vendors/[id]/return/[returnId]/edit */
export async function EditReturnView({ kind, id, returnId }: { kind: ContactKind; id: string; returnId: string }) {
  const terms = SIDES[kind];
  const [contact, entry] = await Promise.all([getCustomerById(id, kind), getReturnById(kind, id, returnId)]);
  if (!contact || !entry) notFound();

  const [contacts, bills] = await Promise.all([getCustomerCards(kind), getCustomerSaleOptions(id, kind, returnId)]);
  const href = `${terms.base}/${id}`;
  return (
    <FormPage title={`Edit ${RETURN_TITLES[kind].toLowerCase()}`} description={contact.name} backHref={href}>
      <ReturnForm
        kind={kind}
        customers={contacts.map((c) => ({ id: c.customer_id, name: c.name, outstanding: c.outstanding, overdue: c.overdue }))}
        initialSales={bills}
        cancelHref={href}
        entry={entry}
      />
    </FormPage>
  );
}
