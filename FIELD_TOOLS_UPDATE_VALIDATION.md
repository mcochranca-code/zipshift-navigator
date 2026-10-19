# ZipShift Field-Tools Visibility Update

## Change

Added an accessible hide/show control to the floating Field tools dock in `client/src/components/field/FieldOperationsDock.tsx`.

- The dock now includes a bilingual **Hide field tools** button with an eye-off icon.
- When hidden, a compact **Show field tools** button remains available.
- Visibility persists in `localStorage` under `zipshift-field-tools-hidden`.
- Hiding the dock closes its open action menu and any active field-tools modal.
- Existing privacy, language, connectivity, queue, and panel actions are unchanged.

## Verification

- Dependencies: `pnpm install --frozen-lockfile` passed.
- TypeScript: `pnpm run check` passed.
- Automated tests: 38 passed, 2 skipped across 11 test files.
- Production build: `pnpm run build` passed.
- Static production preview: HTTP 200 on `/` and `/__manus__/version.json`.
- The combined development preview served the frontend successfully on port 3000. The optional API process could not start because no local MySQL server was available on `127.0.0.1:3306`; this does not affect the static frontend build verification.

## Publication status

The attached archive does not contain a `.git` directory or `manus-webdev.json` project declaration. The known ZipShift Webdev project (`S74U7XgCLcnWWVB3hCQ4Dj`) rejected attachment under the current task identity, so no Manus checkpoint or production publication was created from this session.
