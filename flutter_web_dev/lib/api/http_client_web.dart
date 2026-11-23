import 'package:fetch_client/fetch_client.dart';
import 'package:http/http.dart' as http;

///The session lives in an httpOnly cookie, and answers must arrive as they are
///written. `FetchClient` streams the body; the XHR-backed BrowserClient would
///buffer the whole reply, so Stop could never abort and nothing would stream.
http.Client createHttpClient() => FetchClient(
      mode: RequestMode.cors,
      credentials: RequestCredentials.cors,
      streamRequests: true,
    );
