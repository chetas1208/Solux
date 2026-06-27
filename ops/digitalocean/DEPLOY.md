# Deploying Solux to DigitalOcean App Platform

## Prerequisites

- DigitalOcean account with App Platform access
- MongoDB Atlas cluster (free M0 works for dev)
- GitHub repo with this code
- `doctl` CLI authenticated

## 1. Create MongoDB Atlas cluster

1. Sign up at https://cloud.mongodb.com
2. Create a free M0 cluster
3. Under **Database Access**, create a user with readWrite on `solux` DB
4. Under **Network Access**, allow `0.0.0.0/0` (or DigitalOcean's egress IPs)
5. Copy the connection string: `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/`
6. Run `pnpm db:indexes` locally to create indexes (or run the script on first deploy)

## 2. DigitalOcean Spaces (for report artifacts)

```bash
# Create a Space in the same region as your app
doctl spaces create solux-reports --region nyc3

# Create API keys under Account → API → Spaces Keys
# Note: endpoint is https://<region>.digitaloceanspaces.com
```

## 3. App Platform deployment

**Important:** Solux is a pnpm monorepo. App Platform must use the Dockerfiles — the Node.js buildpack runs `npm install` at the repo root and will fail (no workspace deps, no lockfile).

If your build log shows `heroku/nodejs` or `Installing node modules (package.json)`, the app spec still points at the buildpack. Update it (see **Troubleshooting** below).

### Option A: App Spec (recommended)

Create `.do/app.yaml`:

```yaml
name: solux
region: nyc

services:
  - name: api
    source_dir: /
    dockerfile_path: ops/docker/Dockerfile.api
    http_port: 3001
    instance_size_slug: basic-xxs
    instance_count: 1
    envs:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        type: SECRET
        value: <your atlas uri>
      - key: MONGODB_DB
        value: solux
      - key: GEMINI_API_KEY
        type: SECRET
        value: <your gemini key>
      - key: NREL_API_KEY
        type: SECRET
        value: <your nrel key>
      - key: MINIMAX_API_KEY
        type: SECRET
        value: <optional>
      - key: CORS_ORIGIN
        value: https://<your-web-url>.ondigitalocean.app
      - key: DIGITALOCEAN_SPACES_ENDPOINT
        value: https://nyc3.digitaloceanspaces.com
      - key: DIGITALOCEAN_SPACES_BUCKET
        value: solux-reports
      - key: DIGITALOCEAN_SPACES_KEY
        type: SECRET
        value: <spaces key>
      - key: DIGITALOCEAN_SPACES_SECRET
        type: SECRET
        value: <spaces secret>

  - name: web
    source_dir: /
    dockerfile_path: ops/docker/Dockerfile.web
    http_port: 3000
    instance_size_slug: basic-xxs
    instance_count: 1
    envs:
      - key: NUXT_PUBLIC_API_BASE_URL
        value: https://<api-url>.ondigitalocean.app
      - key: NUXT_PUBLIC_MAPTILER_KEY
        value: <optional maptiler key for dark basemap>
```

Deploy:

```bash
doctl apps create --spec .do/app.yaml
```

### Option A2: GitHub Actions (applies `.do/app.yaml` on every push)

1. Create a [DigitalOcean personal access token](https://docs.digitalocean.com/reference/api/create-personal-access-token/) with read/write scope
2. Add it to GitHub repo secrets as `DIGITALOCEAN_ACCESS_TOKEN`
3. Push to `main` — `.github/workflows/digitalocean-deploy.yml` deploys via Docker using `.do/app.yaml`
4. In the DO control panel, **disable** “Autodeploy” on the old buildpack app (or delete it) to avoid duplicate deploys

### Option B: Manual via UI

1. Go to https://cloud.digitalocean.com/apps → New App
2. Connect GitHub repo
3. Add two services: **api** (Dockerfile: `ops/docker/Dockerfile.api`) and **web** (Dockerfile: `ops/docker/Dockerfile.web`)
4. Set all env vars from `.env.example` in the Environment Variables section
5. Deploy

## 4. Post-deploy: set up MongoDB indexes

Either run locally with production URI or add a one-time job to App Platform:

```bash
MONGODB_URI=<atlas-uri> pnpm db:indexes
```

## 5. Verify deployment

```bash
curl https://<api-url>.ondigitalocean.app/health
# {"status":"ok","version":"0.1.0",...}

curl https://<api-url>.ondigitalocean.app/v1/data-sources
# Shows which providers are configured
```

## Troubleshooting

### Build uses Node.js buildpack instead of Docker

Symptoms in the build log:

```
Detected the following buildpacks ... heroku/nodejs
Installing node modules (package.json)
```

The `.do/app.yaml` file in the repo is **not** applied automatically. You must push the spec to App Platform:

1. **Control panel:** Apps → your app → **Settings** → **App Spec** → **Edit** → paste contents of `.do/app.yaml` (replace `PLACEHOLDER` secrets) → **Save**
2. **CLI:** `doctl apps update <app-id> --spec .do/app.yaml`

Each service must include `dockerfile_path` (e.g. `ops/docker/Dockerfile.api`). Remove any `environment_slug: node-js` or custom `build_command` on those services.

### Docker build fails on `pnpm install`

Ensure `pnpm-lock.yaml` is committed and Dockerfiles copy it. Native deps (esbuild, etc.) are allowlisted in `pnpm-workspace.yaml`.

## Cost estimate

| Component | Size | $/month |
|-----------|------|---------|
| API service | basic-xxs (512MB) | $5 |
| Web service | basic-xxs (512MB) | $5 |
| MongoDB Atlas M0 | free tier | $0 |
| Spaces storage | 250 GB | $5 |
| Total | | ~$15/month |
