# Technical Competency Framework - Accounts Payable

> Status: **APPROVED (v2, 2026-06-13)** and seeded via migration 00076. Accounts
> Payable is the worked example; the same structure is the template for any
> finance function and for client-custom functions derived from a job description.

## 1. Purpose & use cases
A professional, online-assessable **technical** (functional) competency framework -
not behaviour. Two uses from one instrument: **hire / screen** candidates, and
**evaluate / develop** an existing team.

## 2. The model (3 tiers)
```
Function (Accounts Payable)   a JOB / role - NOT banded
  └─ Category                  grouping of competencies - NOT banded (report roll-up only)
        └─ Competency           THE ASSESSED UNIT - banded Basic / Intermediate / Advanced
              └─ Skill          sub-component a question measures; rolls up to the competency
```
- Questions measure **skills**; skills roll up to a **competency %**; each **competency** is banded.
- Bands: **Basic < 60 · Intermediate 60-84 · Advanced ≥ 85**.
- **No** band at Function, Category, or Domain level. Each competency carries an
  **authoritative reference** for defensibility.
- Data: `technical_competencies` (with `category_en/ar`, `reference`) →
  `technical_competency_skills`; the function's `skills_en` blueprint mirrors the 36 skills.

## 3. Accounts Payable - 6 categories · 19 competencies · 36 skills

### 1. Sub-Ledger Accounting Mechanics
| Competency | Skills (measured by questions) | Reference |
|---|---|---|
| Chart of Accounts (CoA) Mapping | Opex vs Capex Classification · Cost-Centre / Project Coding | AICPA / CIMA (CGMA) |
| Accrual & Cut-off Precision | Month-End Unvouched Liabilities · Open-PO Commitment Tracking | IFRS / US GAAP |
| Double-Entry Adjustment Logic | Credit Notes & Short Payments · Correcting Journal Entries | AICPA / CIMA |
| Amortization & Prepaid Recognition | Multi-Period Service Identification · Deferred Expense Scheduling | IFRS / US GAAP |

### 2. Document Verification & Matching Logic
| Competency | Skills | Reference |
|---|---|---|
| Three-Way Matching Execution | Invoice-PO-GRN Cross-Check · Price, Quantity & Terms Verification | IOFM (CAPP) / APQC |
| Exception & Discrepancy Resolution | Variance Root-Cause Analysis · Dispute & Escalation Workflows | IOFM (CAPP) |
| Non-PO Authorization Handling | Delegation-of-Authority (DoA) Checks · Signing-Limit Verification | COSO |

### 3. Financial Data Manipulation & Reconciliation
| Competency | Skills | Reference |
|---|---|---|
| Spreadsheet Data Manipulation | Advanced Functions (XLOOKUP, PivotTables) · Data Cleaning & Filtering | IOFM / APQC |
| Statement of Account Reconciliation | Vendor Statement vs Sub-Ledger · Isolating Missing / Unapplied Items | IOFM (CAPP) |
| Aging Analysis | Aging Bucket Interpretation · Payment Urgency & Debit Balances | IOFM / AICPA |

### 4. ERP & AP Workflow Systems Navigation
| Competency | Skills | Reference |
|---|---|---|
| ERP Transactional Competence | AP Module Fluency (SAP/Oracle/NetSuite) · Batch, Post & Clear Transactions | APQC |
| OCR Engine Gatekeeping | Invoice Ingestion Queues · OCR Field-Mapping Correction | IOFM |
| Electronic Workflow Management | Document Management Platforms · Unblocking Approval Loops | APQC |

### 5. Regulatory, Tax & Internal Control Compliance
| Competency | Skills | Reference |
|---|---|---|
| Multi-Jurisdictional Tax Application | Localized Transaction Taxes (VAT/Sales/Use) · Tax on Complex Multi-Line Invoices | IFRS / US GAAP / Local Tax |
| Withholding Tax (WHT) Compliance | Cross-Border WHT Deductions | Local Statutory Laws |
| Master Data Guardrails | Segregation of Duties (SoD) · Vendor Bank-Change Verification | COSO |
| Fraud Pattern Recognition | Duplicate / Altered-Bank / Split-Invoice Flags | ACFE |

### 6. Treasury & Payment Execution Support
| Competency | Skills | Reference |
|---|---|---|
| Payment Rail Mechanics | Payment Files (ACH/Wire/EFT/V-Card) · Bank-Spec File Formatting | IOFM / APQC |
| Discount Optimization Calculation | Payment-Term Evaluation (2/10 Net 30) · Optimal Payment Timing | AICPA / IOFM |

## 4. Scoring & banding
Each question → one skill → one competency. Competency % = correct/total across its
skills. Band per competency (60/85). Report shows each **category** with its
competencies, each competency's **band + score + reference**, and development
pointers. Category gets a roll-up (e.g. "3 of 4 competencies Advanced"), no band.

## 5. Customisation from a job description
Default = general AP (above). A client JD lets the extractor add/rename competencies
and skills to the role - a custom technical assessment on the same model.

## 6. References (grounding)
APQC Procure-to-Pay PCF · IOFM CAPP standards · COSO Internal Control · ACFE ·
AICPA / CIMA (CGMA) · IFRS / US GAAP.
