import 'package:http/browser_client.dart';
import 'package:http/http.dart' as http;

///The session lives in an httpOnly cookie, so the browser client must send it.
http.Client createHttpClient() => BrowserClient()..withCredentials = true;
