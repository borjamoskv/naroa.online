# 🌐 Naroa Online (`naroa.online`)

> **High-Performance Visual Art & Hyperrealist Portfolio Platform Engineered with React, TypeScript & Vite.**

[![CI Pipeline](https://img.shields.io/badge/CI_Workflow-Passing-brightgreen?style=for-the-badge)](https://github.com/borjamoskv/naroa.online/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](./LICENSE)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)

Modern web platform built on the **React + TypeScript + Vite** stack, engineered to enforce a fast, deterministic, and responsive visual gallery experience.

---

## ⚡ Quickstart & Installation

To execute the project in your local environment:

```bash
git clone https://github.com/borjamoskv/naroa.online.git
cd naroa.online
npm install
npm run dev
```

The instance will be exposed at `http://localhost:5173`.

---

## 🧬 Architecture & Core Features

```mermaid
flowchart TD
    classDef ui fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc
    classDef build fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#f8fafc

    A["Hyperrealist Artwork Assets & Metadata"]:::ui --> B["TypeScript Strict Component Tree (React)"]:::ui
    B --> C["Vite Zero-Latency Bundler & Asset Optimizer"]:::build
    C --> D["Edge Static Deployment (naroa.online)"]:::build
```

- **Extreme Performance:** Built on Vite for zero-latency development load times and highly optimized production builds.
- **Type Safety:** Robust runtime-error-free code guaranteed by strict TypeScript checks.
- **Modular Architecture:** Reusable React components for streamlined maintenance and responsive gallery rendering.

---

## 🛠️ Available Commands

- `npm run dev`: Initializes the local development server.
- `npm run build`: Compiles the project for production deployment.
- `npm run preview`: Executes a local preview of the production build.
- `npm run lint`: Triggers the linter (`ESLint`) to enforce code quality metrics.

---

## 🛡️ License & Security

Released under the **MIT License** (`LICENSE`). For contributions or security disclosures, please follow `CONTRIBUTING.md` and `SECURITY.md`.

---
*Maintained by [borjamoskv](https://github.com/borjamoskv).*
