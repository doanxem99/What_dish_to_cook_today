# flutter_web_dev

Earlier Flutter client for "What dish to cook today?". The Vue client in `../web_ui` is the
current one; this build is still served by the API.

```bash
flutter pub get
flutter test
flutter build web
```

Copy `build/web/*` into `../server/web/` to serve the new build at `http://localhost:3000/`.
The API base URL lives in `lib/storages/app_storage.dart`.
