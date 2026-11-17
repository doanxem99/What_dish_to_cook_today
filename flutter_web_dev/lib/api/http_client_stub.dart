import 'package:http/http.dart' as http;

///Non-web clients keep the plain client; cookies are not needed in tests.
http.Client createHttpClient() => http.Client();
