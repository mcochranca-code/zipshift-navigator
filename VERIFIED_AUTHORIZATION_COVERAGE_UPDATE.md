# Verified Authorization Coverage Update

**Project:** ZipShift Navigator  
**Validation date:** 2026-09-10 PDT  
**Scope:** Deterministic authorized-versus-unauthorized interaction coverage for the role portal, staff workspace, Referrals Dispatch, and Connect-to-ZipShift intake flow.

## Delivered coverage

| Area | Deterministic evidence added | Result |
|---|---|---|
| Role portal navigation | Activates the **Staff intake** and **Referrals** shortcuts and asserts their intended destinations. Navigation itself is not treated as authorization. | Verified |
| Wrong-role workspace session | A client-role response to `/api/auth/me` renders the Admin sign-in surface and does not request any `/api/staff/*` data. | Verified |
| Authorized workspace session | An admin-role response permits the Admin workspace and triggers the protected staff-cases request with `credentials: "include"`. | Verified |
| Unauthorized Referrals Dispatch | Rejected staff API responses render the stable staff-authorization alert. | Verified |
| Authorized Referrals Dispatch | Authorized case and KPI responses render; changing the status selector reloads `/api/staff/cases?status=completed` with session credentials. | Verified |
| Staff intake privacy contract | A name without documented consent is blocked locally and makes no request. A consented intake posts to `/api/intake`, completes only after a `caseId` response, and preserves the existing session-permissive intake contract. | Verified |

The new suite is `client/src/lib/staffAuthorization.interaction.test.tsx` and contains **six deterministic DOM interaction tests**. It uses a scoped `jsdom` test environment, avoiding a change to the default Node environment for the existing API and utility tests.

## Source and test-support changes

| File | Change |
|---|---|
| `client/src/lib/staffAuthorization.interaction.test.tsx` | Added portal, workspace, dispatch, and intake interaction coverage. |
| `client/src/components/StaffWorkspace.tsx` | Added the missing default React import required by the project JSX runtime; the new workspace interaction tests exposed this runtime defect. |
| `package.json`, `pnpm-lock.yaml` | Added `jsdom` as a development dependency for the browser-like interaction suite. |
| `todo.md` | Marked the requested deterministic coverage and full validation tasks complete while retaining real-session and responsive gaps. |
| `docs/drive-workflow-crosswalk.md` | Reconciled the new evidence and clarified the remaining authenticated-browser limitation. |

## Validation results

| Command | Result | Evidence |
|---|---:|---|
| `pnpm test` | Passed with skips | **34 passed**, **2 skipped**, across 8 passing test files and 1 skipped test file. |
| `pnpm check` | Passed | TypeScript completed with `--noEmit` and no errors. |
| `pnpm build` | Passed with warnings | Vite client build and server bundle completed successfully. |

> The two skipped tests are the database-backed cases in `server/api.integration.test.ts`; they remain skipped because `DATABASE_URL` is not configured in this validation environment. This is pre-existing evidence coverage that was not represented as executed.

## Remaining evidence gaps

| Gap | Current status |
|---|---|
| Authenticated browser walkthrough of Referrals Dispatch KPI cards and every table action against real case rows | Not executed; still required. |
| Responsive dispatch assertions | Not added; still required. |
| Database-backed server integration suite | Not executed without `DATABASE_URL`; role/API claims from that suite remain unverified in this environment. |
| Build warnings | The production build warns about undefined analytics environment placeholders and a JavaScript chunk over 500 kB. Neither warning failed the build. |

The update deliberately does **not** claim that intake is staff-only: the server’s existing `/api/intake` contract is session-permissive and enforces intake fields and consent. Staff cases and reporting remain role-gated by the protected staff API endpoints.
