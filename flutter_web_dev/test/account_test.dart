//Account state drives the header, the comment box and the vote button.
import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/state/app_state.dart';

http.Response _ok(Object body) {
  return http.Response(json.encode(body), 200,
      headers: {'content-type': 'application/json; charset=utf-8'});
}

void main() {
  test('sign-in posts the credentials and loads the account', () async {
    final calls = <String>[];
    final api = ApiClient('http://test', client: MockClient((request) async {
      calls.add('${request.method} ${request.url.path}');
      if (request.url.path == '/api/auth/signin') {
        expect(json.decode(request.body), {'username': 'demo', 'password': 'pw'});
        return _ok({'message': 'ok', 'user': {'username': 'demo'}});
      }
      if (request.url.path == '/api/auth/me') {
        return _ok({
          'user': {'id': 'u1', 'username': 'demo', 'email': 'demo@example.com', 'created_at': null}
        });
      }
      return _ok({});
    }));

    final state = AppState(api: api);
    final error = await state.signIn('demo', 'pw');

    expect(error, isNull);
    expect(state.isSignedIn, isTrue);
    expect(state.account?.username, 'demo');
    expect(calls, contains('POST /api/auth/signin'));
  });

  test('a rejected sign-in keeps the guest state and returns the server message', () async {
    final api = ApiClient('http://test', client: MockClient((request) async {
      return http.Response(json.encode({'message': 'User/email or password is not correct!'}), 401,
          headers: {'content-type': 'application/json; charset=utf-8'});
    }));

    final state = AppState(api: api);
    final error = await state.signIn('demo', 'wrong');

    expect(error, 'User/email or password is not correct!');
    expect(state.isSignedIn, isFalse);
  });

  test('an expired session loads as guest without throwing', () async {
    final api = ApiClient('http://test', client: MockClient((request) async {
      return http.Response(json.encode({'message': 'Unauthorized'}), 401,
          headers: {'content-type': 'application/json; charset=utf-8'});
    }));

    final state = AppState(api: api);
    await state.refreshAccount();

    expect(state.isSignedIn, isFalse);
    expect(state.account, isNull);
  });

  test('sign-out clears the account even when the server is unreachable', () async {
    final api = ApiClient('http://test', client: MockClient((request) async {
      if (request.url.path == '/api/auth/me') {
        return _ok({'user': {'id': 'u1', 'username': 'demo'}});
      }
      throw http.ClientException('offline');
    }));

    final state = AppState(api: api);
    await state.refreshAccount();
    await state.signOut();

    expect(state.isSignedIn, isFalse);
  });

  test('sign-up signs the new account in', () async {
    final calls = <String>[];
    final api = ApiClient('http://test', client: MockClient((request) async {
      calls.add(request.url.path);
      if (request.url.path == '/api/auth/signup') {
        return _ok({'message': 'User was registered successfully!'});
      }
      if (request.url.path == '/api/auth/signin') {
        return _ok({'message': 'ok'});
      }
      return _ok({'user': {'id': 'u2', 'username': 'newbie'}});
    }));

    final state = AppState(api: api);
    final error = await state.signUp('newbie', 'new@example.com', 'pw');

    expect(error, isNull);
    expect(state.account?.username, 'newbie');
    expect(calls, ['/api/auth/signup', '/api/auth/signin', '/api/auth/me']);
  });

  test('a stale /auth/me answer cannot clear a fresh session', () async {
    final firstMe = Completer<http.Response>();
    var meCalls = 0;
    final api = ApiClient('http://test', client: MockClient((request) async {
      if (request.url.path == '/api/auth/signin') {
        return _ok({'message': 'ok'});
      }
      meCalls += 1;
      if (meCalls == 1) {
        return firstMe.future;
      }
      return _ok({'user': {'id': 'u1', 'username': 'demo'}});
    }));

    final state = AppState(api: api);
    final stale = state.refreshAccount();
    await state.signIn('demo', 'pw');
    expect(state.isSignedIn, isTrue);

    firstMe.complete(http.Response(
        json.encode({'message': 'Unauthorized'}), 401,
        headers: {'content-type': 'application/json; charset=utf-8'}));
    await stale;

    expect(state.isSignedIn, isTrue);
    expect(state.account?.username, 'demo');
  });
}
