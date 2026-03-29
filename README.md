# Second Act

Second Act is a report-first web app for DIY investors.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Run dev server:

```bash
npm run dev
```

3. Build production bundle:

```bash
npm run build
```

## Testing

Run the full validation flow:

```bash
./test.sh
```

Run the same flow with coverage output:

```bash
./test.sh --coverage
```

Run only the Vitest suite:

```bash
./test.sh --unit-only
```

Start watch mode for local test iteration:

```bash
./test-watch.sh
```

## Environment

Copy `.env.example` and set values:

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_URL`

## Routes

- `/` landing page
- `/legal` legal/disclosure page
- `/api/health` health endpoint
