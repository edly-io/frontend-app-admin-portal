# frontend-app-edl-panel

Admin **MFE for EDL Panel** — user and course enrollment management on Open edX.
It is a standard Open edX micro-frontend built on
[`@openedx/frontend-platform`](https://github.com/openedx/frontend-platform) and
styled with the [Paragon](https://github.com/openedx/paragon) design system, so
it looks and behaves like the platform's other MFEs. It consumes the
`edl-panel` LMS plugin's REST API (`/edl-panel/api/v1/`).

> **Status:** Feature-complete (EDL-11→18). Screens: Users (search / status
> filter / paginate + deactivate-reactivate), Create user (inline validation +
> set-password-link/copy result), Enrollment (enroll/unenroll one-or-many with
> email toggle + per-identifier results), Staff & roles (grant/revoke
> course-scoped roles). A 403 access-denied shell gates non-admins. Lint,
> build and tests pass.

## Does it run on the same server as the other Open edX MFEs?

**Yes.** This is a conventional MFE, so Tutor's
[`tutor-mfe`](https://github.com/overhangio/tutor-mfe) plugin builds it into the
**same MFE Docker image** and serves it from the **same MFE container/webserver**
as `learning`, `authoring`, `account`, etc. — path-routed on the MFE host
(e.g. `…/edl-panel`). It shares their JWT auth and Paragon styling and calls the
`edl-panel` REST API on the LMS host.

The LMS plugin also owns `https://<lms>/edl-panel/` (a Django landing route). Two
clean ways to make that path show this MFE: (a) the landing view 302-redirects
to the MFE URL (recommended), or (b) a proxy rule maps it to the MFE. Decide when
wiring Tutor.

## Styling

Uses `@openedx/paragon` + `@edx/brand` (aliased to `@openedx/brand-openedx`) —
the same tokens, typography and components as every other MFE. The header chrome
here is built from Paragon primitives; the shared
`@edx/frontend-component-header`/`-footer` can be dropped in later without
touching page code.

## Local development

```bash
npm install
npm start          # serves on http://localhost:8080 (PUBLIC_PATH=/edl-panel/)
```

Point `LMS_BASE_URL` in `.env.development` at your LMS. You must be logged into
the LMS as a member of the `edl_admin` group (or a superuser) — the app requires
authentication and the API enforces the EDL-admin gate.

```bash
npm test           # jest
npm run lint       # eslint
npm run build      # production bundle -> dist/
```

## Registering with Tutor (tutor-mfe)

Add it to the MFE app list via a small Tutor plugin (e.g. `edl_panel_mfe.py`):

```python
from tutormfe.hooks import MFE_APPS

@MFE_APPS.add()
def _add_edl_panel_mfe(apps):
    apps["edl-panel"] = {
        "repository": "https://github.com/edl/frontend-app-edl-panel.git",
        "port": 8080,
    }
    return apps
```

Then `tutor plugins enable edl_panel_mfe`, rebuild the MFE image
(`tutor images build mfe`), and restart. Configure the CORS/CSRF trusted origins
on the LMS so the MFE host may call `/edl-panel/api/v1/`.

## Caveats

Dependencies are aligned to the **Ulmo** release (`release/ulmo.3`, verified
against `frontend-app-gradebook`), and the app **builds** (`npm run build`) and
**tests** pass locally on Node 18. Note `frontend-platform` is `@edx/…` while
`paragon`/`frontend-build`/`brand-openedx` are `@openedx/…`. Paragon 23 ships
compiled CSS (no scss partials), so theme CSS is imported in `index.jsx`. The
`tutor-mfe` image builds MFEs on Node 24. If you target a different Open edX
release, re-align deps from that release's MFE `package.json`.
