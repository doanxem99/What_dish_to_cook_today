import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/tokens.dart';

class AppFooter extends StatelessWidget {
  const AppFooter({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);

    return Container(
      decoration: BoxDecoration(
        color: tokens.bg,
        border: Border(top: BorderSide(color: tokens.line)),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: BoardTokens.boardWidth),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                LayoutBuilder(builder: (context, constraints) {
                  final wide = constraints.maxWidth >= 640;
                  final columns = [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('What dish to cook today?', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: tokens.ink)),
                        const SizedBox(height: 8),
                        Text(
                          state.t('footer.tagline'),
                          style: TextStyle(fontSize: 13, height: 1.6, color: tokens.dim),
                        ),
                      ],
                    ),
                    _links(context, state, tokens, state.t('footer.browse'), [
                      ['/dishes', state.t('nav.dishes')],
                      ['/homemade', state.t('nav.homemade')],
                      ['/ingredients', state.t('nav.ingredients')],
                    ]),
                    _links(context, state, tokens, state.t('footer.aboutCol'), [
                      ['/about', state.t('nav.about')],
                    ]),
                  ];
                  if (!wide) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final column in columns) ...[
                          Padding(padding: const EdgeInsets.only(top: 20), child: column),
                        ],
                      ],
                    );
                  }
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 28),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: columns[0]),
                        Expanded(child: columns[1]),
                        Expanded(child: columns[2]),
                      ],
                    ),
                  );
                }),
                Container(
                  decoration: BoxDecoration(border: Border(top: BorderSide(color: tokens.line))),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        state.t('footer.rights', {'year': '${DateTime.now().year}'}),
                        style: TextStyle(fontSize: 12, color: tokens.dim),
                      ),
                      Text('MIT', style: TextStyle(fontSize: 12, color: tokens.dim)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _links(BuildContext context, AppState state, BoardTokens tokens, String title, List<List<String>> rows) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title.toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim)),
        const SizedBox(height: 10),
        for (final row in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: InkWell(
              onTap: () => Navigator.pushNamed(context, row[0]),
              child: Text(row[1], style: TextStyle(fontSize: 13, color: tokens.ink)),
            ),
          ),
      ],
    );
  }
}
