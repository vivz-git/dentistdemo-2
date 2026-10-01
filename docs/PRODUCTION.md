# Taking ChairFill to production: privacy and compliance

**The demo makes no compliance claim.** It runs on synthetic data in the browser, sends nothing, stores nothing on a server, and has no real authentication. Nothing in this repository has been reviewed by a lawyer, a regulator or an auditor. This document lists what a production build must add and is a starting checklist for qualified advisers, not legal advice. Statute and rule names are pointers; confirm current requirements before relying on them.

## What would be personal data

A production ChairFill would hold: patient name, phone number, email, language, messaging consent, appointment history (which reveals that a person is a dental patient and what treatment they booked), waitlist preferences, and the messages exchanged. Appointment type and timing can be health information in some regimes, so treat the whole dataset as sensitive.

## Principles that apply in every market

- **Purpose limitation.** Use patient data only to manage appointments and offer freed slots. Do not repurpose it for marketing or analytics beyond what the patient agreed to.
- **Data minimisation.** The product needs contact details and scheduling preferences. It does not need clinical notes. Keep clinical data out; the AI guardrails already forbid clinical content in messages.
- **Staff approve every send.** Keep the human approval step. It is also the control that stops an automated system from contacting someone it should not.
- **No clinical prioritisation by software.** Priority is an administrative flag set by qualified clinic staff and explained in a note. The system must not rank by urgency on its own.
- **No invented availability.** Offers may state only the slot, dentist and branch the system holds. Keep the draft guard.

## India (first market)

**Digital Personal Data Protection Act, 2023** and its rules:

- **Consent and notice.** Obtain free, specific, informed consent for the purpose of contacting patients about appointments, with a notice in plain language and the languages the clinic uses. Record who consented, to what, when and how. The demo's per-channel consent record is a model of the data, not a consent flow.
- **Purpose limitation.** Process only for the purpose consented to. Offering a freed slot is within scheduling; promotions are a separate purpose.
- **Data principal rights.** Provide ways to access a summary of data, correct it, erase it, withdraw consent as easily as it was given, and raise a grievance, with a named contact.
- **Withdrawal.** Withdrawing consent must stop messaging immediately and be reflected in eligibility, which the matching engine already gates on.
- **Breach notification.** Have a process to notify the Data Protection Board and affected people of a personal data breach as the rules require.
- **Children and guardians.** Patients under 18 need verifiable parental or guardian consent. Handle this before importing paediatric patients.
- **Significant Data Fiduciary duties** (data protection officer, audits, impact assessments) may apply depending on volume and sensitivity. Take advice.
- **Retention.** Delete or anonymise data when the purpose ends and law no longer requires keeping it. Define a retention period per record type.
- **Cross-border transfer.** Check the current rules before storing or processing outside India.

**Messaging in India:**

- **SMS: TRAI TCCCPR and DLT.** Register the entity, sender IDs (headers) and each message template on a DLT platform through the telecom provider. Transactional and service messages need the right template category. Unregistered content is blocked.
- **WhatsApp Business.** Obtain and record opt-in before messaging. Business-initiated messages outside a 24-hour customer window must use pre-approved templates. Honour opt-outs immediately.
- **Quiet hours.** Do not send outside the clinic's configured window. The demo warns inside quiet hours; production must hold the message until morning.
- **Email.** Include sender identification and an unsubscribe route for anything beyond a transactional message.

## Controls every production build needs

| Area | Requirement |
| --- | --- |
| **Audit log** | Append-only record of who did what and when: approvals, sends, bookings, cancellations, consent changes, settings changes, data exports, and logins. The demo's activity feed is a model, not an audit log. |
| **Role-based access** | Distinct roles (front desk, practice manager, clinician, admin) with least privilege. Staff priority and settings are limited to authorised roles. Per-branch scoping. |
| **Authentication** | Real sign-in with strong passwords or SSO, multi-factor for admins, session expiry. The demo login is a fixed credential and must not ship. |
| **Encryption** | TLS in transit. Encryption at rest for the database and backups. Manage keys in a KMS and rotate them. Mask phone numbers in lists. |
| **Secrets** | Provider keys in a secrets manager, never in the client bundle or the repository. |
| **Data residency** | Host patient data in the region the law and the clinic expect. For India, choose an Indian region and review any transfer abroad. |
| **Retention and deletion** | Defined periods, automated deletion, and a way to fulfil erasure requests including from backups and message logs. |
| **Vendor management** | A data processing agreement with every processor: cloud host, messaging providers, email provider, any AI model provider. Record sub-processors. |
| **AI use** | If a model replaces the demo's templates, send it only the minimum fields, keep the guardrails, keep `guardDraft` as a hard gate, and do not send data to a provider that trains on it. |
| **Backups and recovery** | Tested restores, with the same access controls as production. |
| **Breach response** | A written runbook with contacts, decision rights and notification timelines. |
| **Monitoring** | Alerts for failed sends, unusual volume, repeated login failure, and access outside role. |
| **Testing** | Security review and penetration test before launch. Accessibility check against WCAG 2.2 AA. |
| **Consent store** | A first-class, versioned record of consent per patient per channel with source and timestamp, written by the patient-facing flow, not editable by free-text in the waitlist screen. |

## Other markets (architecture is market-agnostic)

Market config in `src/lib/domain/markets.ts` already carries currency, time zone, channels and a named regime. Each market needs its own review before launch:

| Market | Privacy regime to review | Messaging rules to review | Vendor paperwork |
| --- | --- | --- | --- |
| **Australia** | Privacy Act 1988 and the Australian Privacy Principles; health information is sensitive information; notifiable data breaches scheme | Spam Act 2003 (consent, identification, unsubscribe) | Data processing terms with each vendor; check overseas disclosure (APP 8) |
| **United Kingdom** | UK GDPR and Data Protection Act 2018; health data is special category and needs a lawful basis plus a condition | PECR for electronic marketing and service messages | Data processing agreement with each processor; international transfer mechanism if data leaves the UK |
| **United States** | HIPAA for a covered entity's protected health information, plus state privacy laws | TCPA consent rules for texts and calls | **Business associate agreement (BAA)** with every vendor that touches PHI, including the host, messaging providers and any AI provider |

## What the demo does and does not show

- It shows the **shape** of the controls: a per-channel consent record, consent gates in matching, staff approval, an activity feed, quiet hours, guarded drafts, simulated adapters behind interfaces.
- It does **not** implement authentication, authorisation, encryption, a server, an audit log, retention, data subject requests, breach handling, or any real messaging. Treat each as unbuilt.
- Estimated production figures are computed from clinic-entered list prices. They are estimates for illustration and are not revenue or accounting figures.
