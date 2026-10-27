# Internal Billing Workspace Design

## Intent

Extend WF Studio with one internal workspace for creating proposals and invoices, tracking collections, recording class income and expenses, and exporting clean records for the gestoría. The tool is an organiser and document generator; it does not file taxes, connect to AEAT, or decide tax treatment for the user.

## Goals

- Reuse the existing WF Studio admin and client accounts.
- Maintain a persistent, fully editable product catalogue. Deleting or renaming a product remains effective in later sessions.
- Generate proposals and invoices from stored product defaults or fully custom values.
- Keep separate yearly sequences: `PROP-YYYY-NNNN` and `WF-YYYY-NNNN`.
- Store immutable product and recipient snapshots on historical documents.
- Default product prices to net amounts with 21% VAT, while allowing a different tax treatment per product or line.
- Support a usual 200 EUR + VAT deposit, partial collections, remaining balance, and an automatic advance invoice when the deposit is marked collected.
- Let authenticated clients see their documents and payment status.
- Optionally expose one document through a revocable, seven-day private link without login.
- Let the admin activate a manual payment URL, transfer, or cash only when desired.
- Record class income individually, calculate monthly totals automatically, and also support a direct monthly-summary entry without double counting it as an individual entry.
- Record expenses with supplier data, category, tax breakdown, deductible amount and an attached image or PDF.
- Export monthly, quarterly and annual CSV records for the gestoría.

## Non-goals

- AEAT, SII or VERI*FACTU submission.
- Automated tax returns or tax advice.
- Automatic payment-provider integration or webhook reconciliation.
- A second standalone application outside WF Studio.
- Full double-entry bookkeeping.

## Users and access

- **Admin:** manages catalogue, documents, payment methods, collections, income, expenses, attachments and exports.
- **Authenticated client:** sees only their issued proposals, invoices, balances and active payment option.
- **Temporary visitor:** sees one explicitly shared document through an opaque token that expires after seven days. The link can be revoked early and is closed automatically when the payable balance reaches zero.

## Chosen approach

Build a logically independent `Documentos y contabilidad` module inside the existing WF Studio application. This reuses authentication, clients, Supabase and the existing invoice/payment foundations while keeping its navigation and data model separate from project-management features.

Alternatives considered:

- A separate application connected to WF Studio was rejected because it would duplicate clients, access control and deployment.
- A local-only generator was rejected because clients must see balances online and attachments must remain available away from the original computer.

## Data model

### Catalogue

`billing_products` stores editable names, descriptions, default net price, default tax mode/rate, active state and sort order. Products may be renamed, archived or deleted. Documents never resolve historical values from the current catalogue; each line stores a snapshot.

Initial catalogue entries are `Web Lite`, `Web Express` and `Web Profesional`. Only the confirmed `Web Profesional` price is seeded at 650 EUR net; missing defaults remain nullable until the admin sets them.

### Documents

`billing_documents` represents proposals, invoices and advance invoices. It stores its own number, optional source proposal and parent/final invoice links, recipient snapshot, dates, status, notes and totals. `billing_document_lines` stores description, quantity, unit net price, tax mode/rate and calculated amounts.

Proposals remain editable while in draft. Issuing freezes their snapshot. Invoices use their own sequence and remain historical records. A proposal is not automatically converted into a final invoice; the admin creates the invoice from the same template or proposal data when appropriate.

### Collections and payment options

`billing_payments` records every partial or complete collection with amount, date, method and optional note. The balance is document total minus non-reversed payments. Recording a taxable advance against a proposal creates a linked advance invoice draft automatically for admin review.

`billing_payment_options` stores a disabled-by-default method for a document: manual HTTPS URL, transfer instructions or cash. Activation controls what the client sees; it is not evidence of collection.

### Temporary shares

`billing_share_links` stores only a hash of a random token, document id, expiry, revocation and creation metadata. The raw token is shown once. Public lookup is server-side, rate-limited by the hosting layer, read-only and limited to the selected document.

### Income and expenses

`ledger_income` stores category, description, date/month, source mode (`individual` or `monthly_summary`), net amount, tax mode/rate, tax amount, total and optional document/payment references. Monthly totals aggregate individual entries and show manual summaries separately so they cannot silently duplicate each other.

`ledger_expenses` stores supplier, supplier tax id, invoice/reference, dates, category, net amount, tax rate, tax paid, deductible amount, total, payment method and notes. `ledger_expense_attachments` references private Supabase Storage objects and restricts downloads to admins.

### Reporting

The dashboard filters by month, quarter and year and displays net income, output tax, collections, outstanding balance, expenses, input tax, deductible tax and a category breakdown. CSV export produces separate document, income, payment and expense datasets using the same filters.

## Core workflows

1. Admin selects a catalogue product or custom document, changes any snapshot values, and saves a proposal or invoice draft.
2. Admin issues the document. Registered clients see it in their portal; external recipients remain admin-only unless shared.
3. Admin optionally activates a payment method or creates a seven-day private link.
4. Admin records one or more collections. The displayed balance updates immediately. A collected proposal deposit offers a prefilled advance invoice for review.
5. Admin logs class income individually or as an explicit monthly summary.
6. Admin records an expense and uploads its receipt/invoice.
7. Admin filters a period and downloads CSV files and supporting attachments for the gestoría.

## Validation and safety

- Monetary calculations use integer cents in application helpers and constrained numeric columns in PostgreSQL.
- Document totals are calculated from lines, never trusted from a browser-supplied total.
- Payment sums cannot exceed the remaining balance without an explicit credit/adjustment workflow, which is outside this version.
- A monthly-summary entry is visibly labelled and excluded from an "individual total" subtotal.
- Attachments accept PDF, JPEG, PNG and WebP with an explicit size limit and private storage.
- Payment URLs require HTTPS but are not limited to Stripe.
- Draft validation errors do not consume a final document number.

## Success criteria

- The admin can create a 650 EUR + 21% proposal, record a 200 EUR + VAT deposit, produce an advance invoice, and see a 450 EUR + VAT balance without manual arithmetic.
- Catalogue edits persist and do not alter historical documents.
- A client sees the same balance through the portal and through a valid seven-day share link, but cannot see another client's data.
- Individual class income rolls into its month; a direct monthly entry is clearly separated.
- An expense retains its private attachment and appears in the correct period export.
- Tests cover calculations, sequences, access control, token expiry, partial payments, duplicate-summary presentation and attachment policy.

