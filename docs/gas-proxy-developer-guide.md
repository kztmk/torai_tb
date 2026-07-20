# GAS Proxy Authentication Developer Guide

## Purpose

This document describes the secure GAS proxy flow between `snake-sns` and `x_Autopost`.

The goal is to keep the GAS Web App public enough to be called by Firebase Functions, while preventing arbitrary callers from using a user's GAS URL to read or mutate spreadsheet data.

## Components

### `x_Autopost`

`x_Autopost` owns the GAS-side authorization check.

Relevant GAS behavior:

- `POST ?target=security&action=initialize` is the one-time unauthenticated initialization endpoint.
- `GET ?target=security&action=status` is the unauthenticated status endpoint.
- All other `doPost` and `doGet` requests call `assertProxyAuthorized(...)`.
- POST auth data is read from JSON body `_auth`.
- GET auth data is read from query params.
- Signature payload is:

```text
timestamp.uid.action.target.stableJsonPayloadWithoutAuth
```

For GET requests, the signed payload is the query parameter object after removing auth-only parameters (`uid`, `firebaseUid`, `timestamp`, `signature`, `requestId`). Query parameter values are always represented as arrays, even when there is only one value. This means values such as `functionName` are protected by the HMAC signature.

`stableStringify` intentionally follows standard JSON object behavior for `undefined` object properties: properties whose value is `undefined` are omitted from the signed object. `undefined` array items still serialize as `null`.

### `snake-sns` Firebase Functions

`functions/src/handlers/proxy.ts` now owns the server-side proxy contract.

It provides:

- `initializeGasProxyAuth`: callable function for first-time GAS connection.
- `proxyToGas`: HTTP function behind `/api/gas-proxy`.

### `snake-sns` Frontend / Redux

Frontend code no longer sends the raw GAS URL to `/api/gas-proxy` on every request.

Instead:

- `src/utils/gasProxyClient.ts` attaches the current Firebase ID token.
- Redux thunks call `/api/gas-proxy` with `action` and `target`.
- Functions resolves the user's GAS URL and proxy secret server-side.

## Initialization Flow

1. User opens the Spreadsheet and reloads it after the GAS code is deployed.
2. GAS `onOpen()` adds the `虎威連携` custom menu.
3. User selects `虎威連携` -> `本人確認コードを生成`.
4. `showFirebaseSetupCodeDialog()` calls `generateFirebaseSetupCode()` and displays the setup code in a copyable modal dialog.
5. User enters the GAS Web App URL and setup code in `src/pages/Profile/ApiKeys.tsx`.
6. `saveApiKeys` in `src/store/reducers/auth/apiThunks.ts` calls `initializeGasProxyAuth` when `gasSetupCode` is present.
7. `initializeGasProxyAuth` sends:

```json
{
  "uid": "<firebase uid>",
  "setupCode": "<setup code>"
}
```

to:

```text
<gas web app url>?action=initialize&target=security
```

8. GAS validates the setup code and stores the owner UID internally.
9. GAS returns a `proxySecret`.
10. Functions stores:

```text
Realtime Database: user-data/{uid}/settings/googleSheetUrl
Realtime Database: user-data/{uid}/settings/gasProxyInitializedAt
Firestore: gasProxySecrets/{uid}/gasProxySecret
```

The proxy secret is intentionally stored outside the RTDB settings object that the client reads into Redux.

## Runtime Proxy Flow

Frontend call:

```ts
gasProxyPost(body, {
  action: 'fetch',
  target: 'postData',
});
```

`gasProxyPost` sends:

- `POST /api/gas-proxy`
- `Authorization: Bearer <Firebase ID token>`
- query params containing `action` and `target`
- JSON body for POST-style GAS operations

Functions then:

1. Verifies the Firebase ID token.
2. Loads `googleSheetUrl` from RTDB.
3. Loads `gasProxySecret` from Firestore.
4. Builds the GAS signature.
5. For `action=fetch`, forwards to GAS as GET.
6. For other actions, forwards to GAS as POST with `_auth` in the JSON body.

## Signing Details

Functions mirrors the GAS signature contract.

Payload:

```text
timestamp.uid.action.target.stableJsonPayloadWithoutAuth
```

HMAC:

```text
HMAC_SHA256(payload, gasProxySecret)
```

Encoding:

```text
base64 with + replaced by - and / replaced by _
```

Trailing `=` padding is removed after web-safe Base64 encoding.

POST body sent to GAS:

```json
{
  "...": "original fields",
  "_auth": {
    "uid": "<firebase uid>",
    "timestamp": "<unix ms>",
    "signature": "<signature>",
    "requestId": "<uuid>"
  }
}
```

GET query params sent to GAS:

```text
uid=<firebase uid>
timestamp=<unix ms>
signature=<signature>
requestId=<uuid>
```

## Updated Frontend Call Sites

The following Redux modules now use `gasProxyPost`:

- `src/store/reducers/xAccountsSlice.ts`
- `src/store/reducers/xPostsSlice.ts`
- `src/store/reducers/xPostedSlice.ts`
- `src/store/reducers/xErrorsSlice.ts`
- `src/store/reducers/apiControllerSlice.ts`

These modules still check that `googleSheetUrl` exists in Redux state for user-facing validation, but the proxy no longer trusts a client-provided GAS URL.

## Security Notes

- The browser does not receive `gasProxySecret`.
- The proxy no longer relies on `X-Target-Gas-Url` from the client.
- A valid Firebase session is required for every `/api/gas-proxy` request.
- GAS independently verifies UID, timestamp, request ID, and signature.
- The GAS-side replay cache rejects duplicate request IDs inside the configured tolerance window.
- `security/initialize` should only be used during first-time setup or reconnection.

## Deployment Notes

Deploy both Functions and Hosting after changing this flow.

Functions must be deployed because:

- `initializeGasProxyAuth` is a new callable.
- `proxyToGas` now verifies Firebase ID tokens and signs GAS requests.

Hosting must be deployed because:

- Redux thunks now use `gasProxyClient`.
- The profile API key screen includes `GAS本人確認コード`.

`x_Autopost` must also be deployed with the UID signature check and required Apps Script scopes.

After deploying the GAS code, the user must reload the Spreadsheet once so the `onOpen()` trigger can add the `虎威連携` menu.

## Firestore Rules Consideration

`gasProxySecrets/{uid}` is intended for server-side access only.

Do not expose this collection to client reads. If Firestore security rules are updated, explicitly deny client access to `gasProxySecrets`.

Example rule shape:

```text
match /gasProxySecrets/{uid} {
  allow read, write: if false;
}
```

Firebase Admin SDK in Cloud Functions bypasses client security rules, so Functions can still read and write this collection.

## Troubleshooting

### `GAS proxy authorization is not initialized for this user.`

The user has not completed `initializeGasProxyAuth`, or `gasProxySecrets/{uid}` is missing.

Ask the user to enter the GAS URL and a fresh setup code in the profile API key screen.

### `Firebase UID is not authorized for this spreadsheet.`

The GAS project is initialized for a different Firebase UID.

Use the matching account. Moving an initialized GAS project to another Torai account is not supported by design. If the user must use the sheet contents from another account, copy only the spreadsheet data into a new Spreadsheet and connect that new Spreadsheet with a new GAS Web App.

### `Invalid request signature.`

Check that:

- `stableStringify` in Functions matches GAS.
- The POST body being signed excludes `_auth`.
- GET requests sign the query parameter object after auth-only parameters are removed.
- GET query parameter values are represented as arrays on both sides.
- `undefined` object properties are omitted on both sides.
- The stored secret is the current secret returned by GAS initialization.

### `Request timestamp is outside the allowed window.`

Check server time drift and the GAS-side tolerance window.

### `Duplicate request detected.`

The same `requestId` was reused. Functions generates a new UUID per request, so this usually indicates retry/replay behavior outside the expected path.

### Spreadsheet permission errors

The GAS deployment has not granted Spreadsheet scopes yet, or the manifest scopes are incomplete.

Reauthorize and redeploy the GAS Web App.
