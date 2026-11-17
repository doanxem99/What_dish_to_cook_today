//Account state drives the header, the comment box and the vote button.
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

  test('sign-out clears the account and calls the server once', () async {
    final calls = <String>[];
    final api = ApiClient('http://test', client: MockClient((request) async {
      calls.add(request.method);
      if (request.url.path == '/api/auth/me') {
        return _ok({'user': {'id': 'u1', 'username': 'demo'}});
      }
      return _ok({'message': 'Logout successfully!'});
    }));

    final state = AppState(api: api);
    await state.refreshAccount();
    expect(state.isSignedIn, isTrue);

    await state.signOut();

    expect(state.isSignedIn, isFalse);
    expect(calls.where((method) => method == 'POST'), hasLength(1));
  });
}
