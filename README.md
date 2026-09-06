# NOVAMENU

**NOVAMENU** is a digital restaurant menu and ordering platform built for modern restaurants.

It provides restaurants with a digital menu, QR-based access, online ordering, restaurant operations tools, team management, pricing controls, and subscription-based plans.

## Features

* Digital restaurant menu
* QR code menu access
* Customer ordering
* WhatsApp ordering
* Order management
* Menu management
* Extras and sauces
* Restaurant pricing & promotions
* Team management and permissions
* QR Studio
* Restaurant customization and branding
* Billing and subscription management
* 7-day full-access trial
* Paddle-powered payments and subscriptions

## Tech Stack

* **Next.js**
* **TypeScript**
* **React**
* **Tailwind CSS**
* **Supabase**
* **Paddle**
* **Lucide React**

## Getting Started

### Prerequisites

Make sure you have:

* Node.js installed
* npm installed
* A Supabase project
* Paddle credentials for billing functionality

### Installation

Clone the repository:

```bash
git clone https://github.com/jana-srour/NovaMenu.git
cd NovaMenu
```

Install dependencies:

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the project root.

Add the required environment variables for Supabase and Paddle.

**Never commit `.env.local` or any production secrets to Git.**

### Run the Development Server

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

The application will automatically reload when you make changes.

## Production Build

To create a production build:

```bash
npm run build
```

To run the production build locally:

```bash
npm start
```

## Project Structure

```text
app/
├── api/
├── dashboard/
├── login/
├── signup/
└── menu/

lib/
├── billing/
├── live-sync.ts
├── pricing-audit.ts
├── restaurant-theme.ts
├── supabase.ts
└── team-permissions.ts

public/
```

## Billing

NOVAMENU uses Paddle for subscription billing.

Available plans:

| Plan       | Monthly | Yearly |
| ---------- | ------: | -----: |
| Starter    |     $25 |   $250 |
| Pro        |     $69 |   $690 |
| Enterprise |     $99 |   $890 |

New restaurants receive a **7-day trial with full access to implemented features**.

Subscriptions automatically renew unless canceled.

## Security

Sensitive credentials are stored through environment variables and must never be committed to the repository.

The repository intentionally excludes environment files through `.gitignore`.

## Deployment

NOVAMENU can be deployed using Vercel or another Next.js-compatible hosting platform.

For production deployment, configure all required environment variables in the hosting provider and use the Paddle **Live** environment.

The Paddle webhook endpoint is:

```text
/api/paddle/webhook
```

## License

Proprietary software developed by **Novera Labs**.

© Novera Labs. All rights reserved.
