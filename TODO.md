# TODO

## Firebase Admin SDK v14 migration preparation

- [ ] `functions` の `firebase-admin` 利用を legacy namespace 形式から modular import へ移行する。
  - 背景: `firebase-admin` v14 では deprecated legacy namespace support が削除され、`admin.firestore()`, `admin.auth()`, `admin.database()`, `admin.apps` などの形式が利用できなくなる。
  - 対応例:
    - `import admin from 'firebase-admin'` を `firebase-admin/app`, `firebase-admin/firestore`, `firebase-admin/auth`, `firebase-admin/database` などの個別importへ置き換える。
    - `admin.initializeApp()` / `admin.apps.length` を `initializeApp()` / `getApps()` に置き換える。
    - `admin.firestore()` を `getFirestore()` に置き換える。
    - `admin.firestore.FieldValue` / `admin.firestore.Timestamp` を `FieldValue` / `Timestamp` に置き換える。
    - `admin.auth()` を `getAuth()` に置き換える。
    - `admin.database()` を `getDatabase()` に置き換える。
  - 注意: 2026-06-18時点では `firebase-functions@7.2.5` / `7.2.6-rc.0` の peerDependencies が `firebase-admin` v14 を許容していないため、依存更新は `firebase-functions` 側のv14対応後に再判断する。
