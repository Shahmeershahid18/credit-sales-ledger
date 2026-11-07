import React from 'react';
import { notFound } from 'next/navigation';
import { getCustomerById, getCustomerCards, getCustomerSaleOptions, getLedger, getMaterials, getParties } from '@/lib/queries';
import { ContactKind, SIDES } from '@/lib/contacts';
import { Customer } from '@/lib/types';
import { CustomerForm } from '@/components/CustomerForm';
import { MergeParty } from '@/components/MergeParty';
import { SaleForm } from '@/components/SaleForm';
import { PaymentForm } from '@/components/PaymentForm';
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
  const others = (await getParties()).filter((p) => p.id !== id);
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title={`Edit ${terms.one}`} description={contact.name} backHref={href} />
      <div className={`${cardClass} p-5 sm:p-6`}>
        <CustomerForm kind={kind} customer={contact} cancelHref={href} />
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

  // Any party can be picked: this side's first, then the others, which take on this role
  const [parties, { materials, available }] = await Promise.all([getParties(), getMaterials()]);
  const hasRole = (c: Customer) => (kind === 'vendor' ? c.is_vendor : c.is_customer);
  const ordered = [...parties.filter(hasRole), ...parties.filter((c) => !hasRole(c))];
  const otherLabel = `${SIDES[kind === 'vendor' ? 'customer' : 'vendor'].One} · becomes a ${terms.one} too`;
  return (
    <FormPage title={terms.newEntryTitle} backHref="/dashboard">
      <SaleForm
        kind={kind}
        customers={ordered.map((c) => ({ id: c.id, name: c.name, phone: hasRole(c) ? c.phone : otherLabel }))}
        materials={materials}
        materialsAvailable={available}
        cancelHref="/dashboard"
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
