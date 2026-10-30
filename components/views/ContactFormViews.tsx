import React from 'react';
import { notFound } from 'next/navigation';
import { getCustomerById, getCustomerCards, getCustomerSaleOptions, getCustomers, getLedger, getMaterials } from '@/lib/queries';
import { ContactKind, SIDES } from '@/lib/contacts';
import { CustomerForm } from '@/components/CustomerForm';
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
  return (
    <FormPage title={`Edit ${terms.one}`} description={contact.name} backHref={href}>
      <CustomerForm kind={kind} customer={contact} cancelHref={href} />
    </FormPage>
  );
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

  const [contacts, { materials, available }] = await Promise.all([getCustomers(kind), getMaterials()]);
  return (
    <FormPage title={terms.newEntryTitle} backHref="/dashboard">
      <SaleForm
        kind={kind}
        customers={contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
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
    const [ledger, sales] = await Promise.all([getLedger(id), getCustomerSaleOptions(id)]);
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
