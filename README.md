# Globalfer Website

Website for Globalfer, a construction steel and reinforcement supplier serving Marilia and the surrounding region.

The site presents the company, product catalog, services, business advantages, and a quote request form for customers who need cut, bent, or assembled steel products for construction work.

## Main Features

- Responsive React landing page for desktop and mobile.
- Product sections for rebar, columns, stirrups, trusses, wire, nails, and related steel products.
- Service sections for custom cutting, bending, and assembly.
- Contact and quote request form with multiple product line items.
- Express API endpoint for sending quote requests by email through SMTP.
- Static production build generated with Vite.
- GitHub Actions workflow for publishing the built site to GitHub Pages.

## Tech Stack

- React 18
- Vite
- CSS Modules
- Express
- Nodemailer
- GitHub Actions

## Project Structure

```text
src/
  components/   React sections used by the page
  data/         Product and service content
  styles/       Global styles and CSS modules
public/
  assets/       Images and static files copied into the build
server/
  index.js      Environment loading and server startup
  app.js        Express application and email quote API
.github/
  workflows/    GitHub Pages deployment workflow
```

## Getting Started

Install dependencies:

```bash
npm install
```

Run the React frontend and Express server together:

```bash
npm run dev
```

Frontend runs at `http://127.0.0.1:5173/globalfer-site/`, and the API server runs from `server/index.js`. Vite keeps port 5173 fixed to match the default `FRONTEND_URL`; if occupied, stop the other process or configure both values together. Open the printed `127.0.0.1` URL, since `localhost` is a different browser origin.

Use a supported Node release; this checkout was tested with Node 24.15.0 and npm 11.12.1. The compatibility floor for the automated tests is Node 18.13, but old end-of-life runtimes should not be used for production.

Run the API and mail-composition security tests:

```bash
npm test
```

Tests inject fake SMTP behavior or generate email in memory. They do not load `.env`, contact an SMTP provider, or send real email. See [SECURITY-AUDIT.md](SECURITY-AUDIT.md) for advisory details, validation results, proxy configuration, and non-OneDrive reproduction commands.

## Environment Variables

Copy `.env.example` to `.env` and fill in the SMTP values before using the quote email endpoint.

```bash
PORT=3001
FRONTEND_URL=http://127.0.0.1:5173
QUOTE_EMAIL_TO=globalfer_marilia@yahoo.com.br
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app
SMTP_FROM="Site Globalfer <seu-email@gmail.com>"
```

The `.env` file is ignored by Git and should not be committed.

## Build

Create the production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Deployment

The repository includes a GitHub Actions workflow at `.github/workflows/deploy.yml`.

When changes are pushed to the `main` branch, the workflow installs dependencies, runs the Vite build, uploads the `dist` folder as a Pages artifact, and deploys it to GitHub Pages.

The default asset base is `/globalfer-site/`, retained from this repository's real `main` branch. For default project Pages hosting, the expected frontend URL is `https://fernandoh88.github.io/globalfer-site/`. Use `/` instead only when the actual hosting uses a custom-domain root.

**Production API configuration is still required.** The current workflow does not supply `VITE_API_URL`. The form constructs `${import.meta.env.VITE_API_URL || ''}/api/orcamento`, so an unconfigured Pages build calls `/api/orcamento` on the Pages origin, where no Express server runs. A successful static build does not establish working email submission.

After the real separately hosted HTTPS backend is identified, set the GitHub repository Actions variable `VITE_API_URL` to its origin, with no trailing slash or endpoint path. Then adapt the existing build step as follows; this is a recommendation, not an applied workflow change:

```yaml
- name: Compilar site
  env:
    VITE_API_URL: ${{ vars.VITE_API_URL }}
  run: |
    test -n "$VITE_API_URL" || { echo "Configure the actual separately hosted HTTPS API URL."; exit 1; }
    npm run build
```

On that backend, use `FRONTEND_URL=https://fernandoh88.github.io` for default Pages hosting, or the actual custom-domain origin. Do not include `/globalfer-site/` or a trailing slash. No backend URL has been guessed, no backend deployed, and no repository variable configured by this migration. `VITE_*` values become public browser configuration; keep SMTP credentials exclusively on the backend.

CI retains Node 20, which satisfies the locked dependency engine ranges but reached end of life on April 30, 2026. Moving CI to a maintained LTS runtime is a follow-up; local verification used Node 24.15.0. See the [official Node release schedule](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json).

## API Endpoints

- `GET /api/health` returns a basic health check.
- `POST /api/orcamento` validates a quote request and sends it to the configured email address.

The quote endpoint requires the SMTP environment variables listed above.

Set `FRONTEND_URL` to the exact public frontend origin (scheme, host and optional port; no path or trailing slash). Requests with a different browser Origin are rejected. GitHub Pages hosts only the static frontend; configure `VITE_API_URL` at build time for a separately hosted HTTPS API. When serving the frontend directly from Express at `/`, build with `VITE_BASE_PATH=/` instead of the GitHub Pages base path.
