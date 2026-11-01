export type InvoiceStatus = 'draft' | 'sent' | 'pending' | 'overdue' | 'paid';

/** Unpaid and owed: the client can (or should) pay these. */
export const isOutstanding = (status: string) => status === 'sent' || status === 'pending' || status === 'overdue';

/** Client-facing label. 'sent' means issued and unpaid, so it reads "Due", never "Paid". */
export function clientInvoiceLabel(status: string): 'Paid' | 'Overdue' | 'Draft' | 'Due' {
  if (status === 'paid') return 'Paid';
  if (status === 'overdue') return 'Overdue';
  if (status === 'draft') return 'Draft';
  return 'Due';
}
