import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/board_card.dart';

///Header mirrors the Vue client: brand, search against the tool group,
///language and theme, then a scrollable nav strip.
class NavBar extends StatefulWidget {
  const NavBar({super.key, required this.active, this.initialQuery = ''});

  final String active;
  final String initialQuery;

  @override
  State<NavBar> createState() => _NavBarState();
}

class _NavBarState extends State<NavBar> {
  late final TextEditingController _search;

  @override
  void initState() {
    super.initState();
    _search = TextEditingController(text: widget.initialQuery);
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _submitSearch() {
    final query = _search.text.trim();
    Navigator.pushNamed(context, '/dishes', arguments: {'q': query});
  }

  void _go(String path) {
    if (path == widget.active) {
      return;
    }
    //Vue's router pushes a new history entry per tap; Flutter matches so the
    //browser back button walks the same trail.
    Navigator.pushNamed(context, path);
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);

    return Container(
      decoration: BoxDecoration(
        color: tokens.bg,
        border: Border(bottom: BorderSide(color: tokens.line)),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: BoardTokens.boardWidth),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: LayoutBuilder(builder: (context, constraints) {
              final narrow = constraints.maxWidth < 640;
              final brand = Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: GestureDetector(
                    onTap: () => _go('/'),
                    child: Text(
                      'What dish to cook today?',
                      style: TextStyle(
                        fontSize: narrow ? 13 : 16,
                        fontWeight: FontWeight.w800,
                        color: tokens.ink,
                      ),
                    ),
                  ),
                ),
              );

              final tools = Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const _LanguageButton(code: 'en', label: 'EN'),
                  const SizedBox(width: 4),
                  const _LanguageButton(code: 'vi', label: 'VI'),
                  const SizedBox(width: 4),
                  _ThemeButton(),
                  const SizedBox(width: 4),
                  _AccountEntry(showName: constraints.maxWidth >= 1024, onProfile: widget.active == '/profile'),
                ],
              );

              final search = SizedBox(
                height: narrow ? 34 : 30,
                child: TextField(
                  controller: _search,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _submitSearch(),
                  style: TextStyle(fontSize: 13, color: tokens.ink),
                  decoration: InputDecoration(
                    hintText: state.t('nav.searchPlaceholder'),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    suffixIcon: IconButton(
                      icon: Icon(Icons.search, size: 16, color: tokens.dim),
                      onPressed: _submitSearch,
                      tooltip: state.t('common.search'),
                    ),
                  ),
                ),
              );

              final navStrip = SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _navLink('/dishes', state.t('nav.dishes'), tokens),
                    _navLink('/homemade', state.t('nav.homemade'), tokens),
                    _navLink('/ingredients', state.t('nav.ingredients'), tokens),
                    _navLink('/about', state.t('nav.about'), tokens),
                  ],
                ),
              );

              if (narrow) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(children: [brand, const Spacer(), tools]),
                    const SizedBox(height: 6),
                    search,
                    const SizedBox(height: 4),
                    navStrip,
                  ],
                );
              }

              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      brand,
                      const SizedBox(width: 24),
                      Expanded(
                        child: Align(
                          alignment: Alignment.centerRight,
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 360, minWidth: 160),
                            child: search,
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      tools,
                    ],
                  ),
                  const SizedBox(height: 6),
                  navStrip,
                ],
              );
            }),
          ),
        ),
      ),
    );
  }

  Widget _navLink(String path, String label, BoardTokens tokens) {
    final active = widget.active == path;
    return Padding(
      padding: const EdgeInsets.only(right: 16),
      child: InkWell(
        onTap: () => _go(path),
        child: Container(
          constraints: const BoxConstraints(minHeight: 30),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(color: active ? tokens.amber : Colors.transparent, width: 2),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: active ? tokens.amber : tokens.dim,
              fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

class _LanguageButton extends StatelessWidget {
  const _LanguageButton({required this.code, required this.label});

  final String code;
  final String label;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return BoardButton(
      label: label,
      dense: true,
      active: state.locale == code,
      onPressed: () => state.setLocale(code),
    );
  }
}

class _ThemeButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);
    return Semantics(
      button: true,
      label: state.t('theme.label'),
      child: InkWell(
        onTap: state.toggleTheme,
        child: Container(
          width: 30,
          height: 26,
          decoration: BoxDecoration(border: Border.all(color: tokens.line), borderRadius: BorderRadius.circular(BoardTokens.radius)),
          child: Icon(
            state.isLight ? Icons.dark_mode_outlined : Icons.light_mode_outlined,
            size: 14,
            color: tokens.dim,
          ),
        ),
      ),
    );
  }
}

///Guest sees a sign-in icon (plus Sign up on wide screens); a session shows
///the profile entry and Sign out.
class _AccountEntry extends StatelessWidget {
  const _AccountEntry({required this.showName, required this.onProfile});

  final bool showName;
  final bool onProfile;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);
    void go(String path) => Navigator.pushNamed(context, path);

    if (!state.isSignedIn) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Tooltip(
            message: state.t('nav.signIn'),
            child: InkWell(
              onTap: () {
              if (ModalRoute.of(context)?.settings.name == '/signin') {
                return;
              }
              go('/signin');
            },
              child: Container(
                height: 26,
                padding: EdgeInsets.symmetric(horizontal: showName ? 8 : 0),
                width: showName ? null : 30,
                decoration: BoxDecoration(border: Border.all(color: tokens.line), borderRadius: BorderRadius.circular(BoardTokens.radius)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.person_outline, size: 14, color: tokens.ink),
                    if (showName) ...[
                      const SizedBox(width: 6),
                      Text(state.t('nav.signIn'), style: TextStyle(fontSize: 13, color: tokens.ink)),
                    ],
                  ],
                ),
              ),
            ),
          ),
          if (showName) ...[
            const SizedBox(width: 10),
            InkWell(
              onTap: () => go('/signup'),
              child: Text(state.t('nav.signUp'), style: TextStyle(fontSize: 13, color: tokens.ink)),
            ),
          ],
        ],
      );
    }

    final username = state.account?.username ?? state.t('nav.profile');
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Tooltip(
          message: username,
          child: InkWell(
            key: const ValueKey('account-entry'),
            onTap: () => go('/profile'),
            child: Container(
              height: 26,
              padding: EdgeInsets.symmetric(horizontal: showName ? 8 : 0),
              width: showName ? null : 30,
              decoration: BoxDecoration(border: Border.all(color: tokens.line), borderRadius: BorderRadius.circular(BoardTokens.radius)),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.person_outline, size: 14, color: tokens.ink),
                  if (showName) ...[
                    const SizedBox(width: 6),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 180),
                      child: Text(
                        username,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13, color: tokens.ink),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
        if (showName) ...[
          const SizedBox(width: 10),
          InkWell(
            onTap: () async {
              await state.signOut();
              if (context.mounted && onProfile) {
                Navigator.pushReplacementNamed(context, '/');
              }
            },
            child: Text(state.t('nav.signOut'), style: TextStyle(fontSize: 13, color: tokens.dim)),
          ),
        ],
      ],
    );
  }
}
