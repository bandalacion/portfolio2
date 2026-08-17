# Shared Scheduler Storage Setup

The scheduler uses browser storage as a fallback, but cross-device sync needs the deployed `/api/scheduler` endpoint and Vercel Blob.

## 1. Create Vercel Blob storage

In Vercel:

1. Open your `portfolio2` project.
2. Go to `Storage`.
3. Select `Create Database`.
4. Choose `Blob`.
5. Connect the Blob store to this project.

For newer Vercel Blob stores, Vercel can authenticate server functions with OIDC automatically. If Vercel also creates a `BLOB_READ_WRITE_TOKEN`, keep it only in Vercel environment variables.

## 2. Environment variables

In Vercel project settings, make sure these exist:

```text
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_your_token
SCHEDULER_STATE_ID=main
```

`SCHEDULER_STATE_ID` is optional. It defaults to `main`.

Do not put the Blob read-write token in frontend files or expose it with `NEXT_PUBLIC_`.

## 3. Redeploy

Redeploy the site after connecting Blob. The scheduler should show `Synced` in the top bar after login.

## How it stores data

The whole schedule is stored as one private JSON object:

```text
scheduler/main.json
```

This is simple and works well for the current prototype. If the app grows into many locations, managers, or audit logs, a relational database would become the better fit.
