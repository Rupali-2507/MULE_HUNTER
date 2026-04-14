# 🔗 Blockchain Audit Trail – Mule-Hunter

## 📌 Overview
The blockchain implementation in **Mule-Hunter** serves as an **immutable audit trail** for fraud detection decisions.

Once a transaction is evaluated and a verdict is generated, the result is securely recorded in a way that **cannot be altered, deleted, or tampered with**, ensuring trust, transparency, and accountability.

---

## ⚙️ Architecture: The Merkle Pipeline

To maintain **sub-50ms latency**, the blockchain logic operates **asynchronously** in the background after the response is sent to the user.

### 🔄 Workflow

#### 1. Hashing (Privacy-Preserving)
- A **SHA-256 hash** is generated using:
  - `transactionID`
  - `riskScore`
  - `timestamp`
- ❌ No Personally Identifiable Information (PII) is stored
- ✅ Ensures privacy and compliance

#### 2. Merkle Tree Construction
- Transactions are grouped into batches of **50 decisions**
- Each hash becomes a **leaf node**
- Hashes are combined recursively:
hash1 + hash2 → new hash

- Continues until a single **Merkle Root Hash** is formed

#### 3. Ledger Storage
- Only the **Root Hash** is stored
- Ledger is implemented using **MongoDB**
- Ensures efficient storage with full integrity verification

---

## 🚀 Why Permissioned Blockchain?

We use a **permissioned blockchain** instead of public networks like Ethereum due to system constraints:

### ⚡ Performance
- Public blockchains: High latency (seconds to minutes)
- Mule-Hunter:
- ⚡ Sub-50ms response time
- Blockchain runs asynchronously → no user delay

### 🔐 Access Control
- Public → open to all
- Mule-Hunter → restricted to authorized auditors only
- Ensures compliance with financial regulations

### 💰 Cost Efficiency
- No transaction fees (gas fees)
- Fully controlled infrastructure

---

## 🛡️ Tamper-Evidence Property

The system ensures strong **tamper detection** using Merkle Trees.

### 🔍 Detection Mechanism
- A change in even **1 bit** of transaction data:
- Alters its hash
- Propagates upward → changes Root Hash
- Result:
- ❌ Root mismatch → tampering detected instantly

### 📊 Benefits
- ✅ Data Integrity Verification  
- ✅ Full Auditability  
- ✅ Legal Accountability  

---

## 🧠 Key Design Principles

- ⚡ High Performance (no latency impact)
- 🔒 Privacy-first (no sensitive data stored)
- 📦 Efficient storage (only root hashes)
- 🛡️ Immutable audit trail

---

## 🏁 Summary

The Mule-Hunter blockchain module ensures that fraud detection decisions are:

- ✅ Immutable  
- ✅ Secure  
- ✅ Verifiable  
- ✅ Auditable  

All while maintaining real-time performance required for modern financial systems.