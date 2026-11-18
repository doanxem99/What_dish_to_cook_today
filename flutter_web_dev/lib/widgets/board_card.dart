import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/tokens.dart';

///The ruled surface used for every panel on the board.
class BoardCard extends StatelessWidget {
  const BoardCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(BoardTokens.s4),
  });

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final tokens = BoardTokens.of(AppScope.of(context).isLight);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: tokens.raised,
        border: Border.all(color: tokens.line),
        borderRadius: BorderRadius.circular(BoardTokens.radius),
      ),
      child: child,
    );
  }
}

class BoardButton extends StatelessWidget {
  const BoardButton({
    super.key,
    required this.label,
    this.onPressed,
    this.primary = false,
    this.active = false,
    this.dense = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool primary;
  final bool active;
  final bool dense;
  final String? icon;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tokens = BoardTokens.of(state.isLight);
    final borderColor = active ? tokens.amber : tokens.line;
    final textColor = primary ? Colors.white : (active ? tokens.amber : (onPressed == null ? tokens.dim : tokens.ink));

    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(BoardTokens.radius),
        child: Container(
          height: dense ? 30 : 36,
          padding: EdgeInsets.symmetric(horizontal: dense ? 8 : 10),
          decoration: BoxDecoration(
            color: primary ? tokens.red : Colors.transparent,
            border: Border.all(color: primary ? tokens.red : borderColor),
            borderRadius: BorderRadius.circular(BoardTokens.radius),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[
                Icon(_icon(icon!), size: 13, color: textColor),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  height: 1,
                  fontWeight: active || primary ? FontWeight.w700 : FontWeight.w500,
                  color: textColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static IconData _icon(String name) {
    switch (name) {
      case 'search':
        return Icons.search;
      case 'light':
        return Icons.light_mode_outlined;
      case 'dark':
        return Icons.dark_mode_outlined;
      case 'list':
        return Icons.view_list_outlined;
      case 'grid':
        return Icons.grid_view_outlined;
      case 'chevron':
        return Icons.chevron_right;
      default:
        return Icons.circle_outlined;
    }
  }
}

class BoardChip extends StatelessWidget {
  const BoardChip({
    super.key,
    required this.label,
    this.active = false,
    this.onTap,
    this.onRemove,
  });

  final String label;
  final bool active;
  final VoidCallback? onTap;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final tokens = BoardTokens.of(AppScope.of(context).isLight);
    return Semantics(
      button: onTap != null,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          constraints: const BoxConstraints(minHeight: 34),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: tokens.raised,
            border: Border.all(color: active ? tokens.amber : tokens.line),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(label, style: TextStyle(fontSize: 13, color: active ? tokens.amber : tokens.ink)),
              if (onRemove != null)
                GestureDetector(
                  onTap: onRemove,
                  child: Padding(
                    padding: const EdgeInsets.only(left: 6),
                    child: Icon(Icons.close, size: 13, color: active ? tokens.amber : tokens.dim),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

///Status lamp: full match, partial match, nothing matched.
class MatchLamp extends StatelessWidget {
  const MatchLamp({super.key, required this.kind});

  final String kind;

  @override
  Widget build(BuildContext context) {
    final tokens = BoardTokens.of(AppScope.of(context).isLight);
    final Color color;
    switch (kind) {
      case 'ok':
        color = tokens.green;
        break;
      case 'partial':
        color = tokens.amber;
        break;
      default:
        color = tokens.red;
    }
    return Semantics(
      label: kind,
      child: Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
    );
  }
}

class BoardImage extends StatelessWidget {
  const BoardImage({
    super.key,
    required this.url,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.kind = 'dish',
  });

  final String url;
  final double? width;
  final double? height;
  final BoxFit fit;
  final String kind;

  @override
  Widget build(BuildContext context) {
    final placeholder = Image.asset(
      kind == 'ingredient' ? 'assets/defaults/ingredient.png' : 'assets/defaults/dish.png',
      width: width,
      height: height,
      fit: fit,
    );
    if (url.isEmpty) {
      return ClipRRect(borderRadius: BorderRadius.circular(4), child: placeholder);
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: Image.network(
        url,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (context, error, stack) => placeholder,
      ),
    );
  }
}
