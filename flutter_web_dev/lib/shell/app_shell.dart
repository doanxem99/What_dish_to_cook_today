import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/tokens.dart';
import 'app_footer.dart';
import 'nav_bar.dart';

///Header, scrollable board area capped at 1080 px, footer.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.active, required this.child, this.query = ''});

  final String active;
  final Widget child;
  final String query;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return Scaffold(
      backgroundColor: BoardTokens.of(state.isLight).bg,
      body: SafeArea(
        child: Column(
          children: [
            NavBar(active: active, initialQuery: query),
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: BoardTokens.boardWidth),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                          child: child,
                        ),
                      ),
                    ),
                    const AppFooter(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
