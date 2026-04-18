# Ojasraksha - Frontend Application

The user interface for the **Ojasraksha** decentralized healthcare ecosystem. Built with a modern tech stack centered on **React**, **TypeScript**, and **Tailwind CSS**, it provides a high-performance, responsive, and secure experience for all healthcare stakeholders.

---

## 🚀 Stakeholder Dashboards

Ojasraksha provides 8 specialized portals, each with a focus on specific healthcare workflows:

| Dashboard | Key Features |
| --- | --- |
| **Patient Portal** | Full control over medical history, consent management, and data access. |
| **Doctor Dashboard** | Consult history, authorized record access, and digital prescriptions. |
| **Lab Dashboard** | AES-256-GCM encrypted report uploads and blockchain anchoring. |
| **Pharmacy Queue** | Real-time global queue management for medication dispensing. |
| **Auditor Dashboard** | On-chain audit trail interrogation for DPDP compliance. |
| **Insurance Portal** | Verified medical record access for streamlined claim processing. |
| **Hospital Portal** | Staff role management and facility operational control. |
| **Admin Hub** | System-level configuration and global registry management. |

---

## 🛠️ Technical Implementation

### Core Technologies
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS + daisyUI
- **State Management**: React Hooks + Context API
- **Wallet Connection**: `@txnlab/use-wallet-react` (Defly, Pera, Exodus, KMD)
- **Security**: Crypto Web API for client-side AES-256-GCM encryption.

### Pera Wallet Stability
The project includes a robust polyfill configuration in `vite.config.ts` to ensure compatibility with Node.js modules (like `Buffer`) required by Pera Wallet and Algorand SDKs in a browser environment.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20.0+ (LTS recommended)
- **AlgoKit CLI**: v2.0.0+ ([Install Guide](https://github.com/algorandfoundation/algokit-cli#install))
- **Docker**: For running LocalNet blockchain nodes.

### 2. Installation
Run the following from the `projects/ojasraksha-frontend` directory:
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file from the template:
```bash
cp .env.template .env
```
Ensure `VITE_ALGOD_NETWORK` is set to `localnet` for development or `testnet` for staging.

### 4. Running Locally
```bash
npm run dev
```

---

## 🏗️ Architecture & Best Practices

- **Atomic Design**: Components are modular and reusable.
- **Type Safety**: 100% TypeScript coverage for predictable data flows.
- **Role-Based Routing**: Secure routes gated by on-chain role verification.
- **Responsive UI**: Mobile-first design using Tailwind CSS.

---

<p align="center">Empowering patients through decentralization.</p>

