import 'package:flutter/material.dart';

import '../ai/ai_api.dart';
import '../ai/ai_models.dart';
import '../state/app_state.dart';

///The cook's assistant, mirroring the Vue Ask panel: one input, an inferred
///goal label, streamed answers and citations that open real catalog rows.
class AskSheet extends StatefulWidget {
  const AskSheet({super.key, required this.state});

  final AppState state;

  @override
  State<AskSheet> createState() => _AskSheetState();
}

class _AskSheetState extends State<AskSheet> {
  late final AiApi _api = AiApi(widget.state.api);
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final List<AiChatMessage> _messages = <AiChatMessage>[];
  AiChatCancelToken? _cancel;
  AiQuota? _quota;
  String _capability = 'read_only';
  bool _enabled = false;
  bool _loading = true;
  bool _streaming = false;
  bool _embedDown = false;
  String _errorKey = '';

  AppState get _state => widget.state;
  String t(String key, [Map<String, String>? params]) => _state.t(key, params);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _cancel?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final status = await _api.status();
      final history = await _api.conversation();
      if (!mounted) return;
      setState(() {
        _enabled = status.enabled;
        _capability = status.capability;
        _quota = status.quota;
        _messages
          ..clear()
          ..addAll(history);
        _loading = false;
      });
      _scrollToEnd();
    } on AiApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _enabled = error.status == 404 ? false : _enabled;
        _errorKey = errorStateKey(error.status, error.code);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _errorKey = 'ask.error';
      });
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
      }
    });
  }

  bool get _canSend => _enabled &&
      !_streaming &&
      !(_quota?.isReached ?? false) &&
      validateMessageInput(_input.text);

  String get _lastUserText {
    for (final message in _messages.reversed) {
      if (message.role == 'user' && message.content.trim().isNotEmpty) return message.content;
    }
    return '';
  }

  Future<void> _send({String? overrideMode}) async {
    final text = _lastUserTextRetry(overrideMode);
    if (!validateMessageInput(text)) return;
    final userMessage = AiChatMessage(role: 'user', content: text);
    final assistant = AiChatMessage(role: 'assistant');
    setState(() {
      if (overrideMode == null) {
        _messages.add(userMessage);
      }
      _messages.add(assistant);
      _streaming = true;
      _errorKey = '';
      _embedDown = false;
      _input.clear();
    });
    _scrollToEnd();

    final token = AiChatCancelToken();
    _cancel = token;
    try {
      await _api.streamChat(
        message: text,
        locale: _state.locale,
        capability: _capability,
        mode: overrideMode,
        cancel: token,
        onEvent: (event) {
          if (!mounted) return;
          setState(() {
            switch (event.event) {
              case 'meta':
                assistant.goal = AiGoalChip.from(
                    '${event.data['mode'] ?? ''}', '${event.data['mode_source'] ?? ''}');
                _embedDown = event.data['embed_down'] == true;
                break;
              case 'tool':
                final citations = event.data['citations'];
                if (citations is List) {
                  assistant.citations = mergeCitations(
                      assistant.citations, citations.map(AiCitation.fromJson).toList());
                }
                assistant.tools = [
                  ...assistant.tools,
                  AiToolSummary(
                      name: '${event.data['name'] ?? ''}',
                      summary: event.data['summary'] is Map
                          ? Map<String, dynamic>.from(event.data['summary'] as Map)
                          : const <String, dynamic>{}),
                ];
                break;
              case 'token':
                assistant.content += '${event.data['text'] ?? ''}';
                break;
              case 'notice':
                if (event.data['code'] == 'ungrounded') {
                  assistant.content +=
                      '\n\n${t('ask.shortlistNote')}: ${(event.data['dishes'] as List? ?? const []).join(', ')}';
                }
                break;
              case 'done':
                _quota = AiQuota.fromJson(event.data['quota']);
                break;
              case 'error':
                _errorKey = errorStateKey(
                    (event.data['status'] as num?)?.toInt(), '${event.data['code'] ?? ''}');
                break;
            }
          });
          _scrollToEnd();
        },
      );
    } on AiApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _errorKey = errorStateKey(error.status, error.code);
        assistant.stopped = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _errorKey = 'ask.error';
        assistant.stopped = true;
      });
    } finally {
      if (mounted) {
        setState(() {
          _streaming = false;
          assistant.empty = assistant.content.trim().isEmpty;
          if (token.isCancelled) assistant.stopped = true;
        });
        _scrollToEnd();
      }
    }
  }

  String _lastUserTextRetry(String? overrideMode) {
    final typed = _input.text.trim();
    return overrideMode == null ? typed : (_lastUserText.isNotEmpty ? _lastUserText : typed);
  }

  void _stop() {
    _cancel?.cancel();
    setState(() => _streaming = false);
  }

  Future<void> _changeGoal(AiChatMessage message, String mode) async {
    if (_streaming) return;
    message.goal = AiGoalChip(mode: mode, source: 'user');
    await _send(overrideMode: mode);
  }

  void _openCitation(AiCitation citation) {
    if (!citation.isLinkable) return;
    final path = citation.targetType == 'dish' ? '/dish' : '/ingredient';
    Navigator.pop(context);
    Navigator.pushNamed(context, path, arguments: {'dish_id': citation.id, 'ingredient_id': citation.id});
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.86,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
                child: Row(
                  children: [
                    Expanded(child: Text(t('ask.title'), style: theme.textTheme.titleMedium)),
                    IconButton(
                      tooltip: t('common.close'),
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(t('ask.privacyNotice'),
                    style: theme.textTheme.bodySmall?.copyWith(color: theme.hintColor)),
              ),
              const SizedBox(height: 8),
              Expanded(child: _body(theme)),
              if (!_state.isSignedIn)
                _note(t('ask.signInPrompt'))
              else if (_loading)
                _note(t('common.loading'))
              else if (!_enabled)
                _note(t('ask.disabled'))
              else
                _composer(theme),
            ],
          ),
        ),
      ),
    );
  }

  Widget _body(ThemeData theme) {
    if (_state.isSignedIn && _messages.isEmpty && !_loading) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(t('ask.welcome'), textAlign: TextAlign.center),
        ),
      );
    }
    return ListView.builder(
      controller: _scroll,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      itemCount: _messages.length,
      itemBuilder: (context, index) => _turn(theme, _messages[index], index),
    );
  }

  Widget _turn(ThemeData theme, AiChatMessage message, int index) {
    final isUser = message.role == 'user';
    final last = index == _messages.length - 1;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(isUser ? t('ask.you') : t('ask.assistant'),
              style: theme.textTheme.labelSmall?.copyWith(color: theme.hintColor)),
          if (!isUser && message.goal != null) _goalChip(theme, message),
          if (isUser)
            SelectableText(message.content, style: theme.textTheme.bodyMedium)
          else if (message.content.isNotEmpty)
            SelectableText(message.content, style: theme.textTheme.bodyMedium)
          else if (_streaming && last)
            Text(t('ask.thinking'), style: theme.textTheme.bodyMedium),
          if (!isUser && message.tools.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final tool in message.tools)
                    Chip(
                      label: Text(t(tool.i18nKey, tool.i18nParams)),
                      visualDensity: VisualDensity.compact,
                    ),
                ],
              ),
            ),
          if (!isUser && message.citations.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final citation in message.citations)
                    ActionChip(
                      label: Text(citation.label(_state.locale, t('common.unknown'))),
                      onPressed: () => _openCitation(citation),
                    ),
                ],
              ),
            ),
          if (!isUser && message.stopped)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(t('ask.stopped'), style: theme.textTheme.bodySmall),
            ),
          if (!isUser && message.empty && !_streaming)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(t('ask.emptyAnswer'), style: theme.textTheme.bodySmall),
            ),
        ],
      ),
    );
  }

  Widget _goalChip(ThemeData theme, AiChatMessage message) {
    final goal = message.goal!;
    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 4),
      child: PopupMenuButton<String>(
        enabled: !_streaming,
        tooltip: t('ask.mode.change'),
        onSelected: (mode) => _changeGoal(message, mode),
        itemBuilder: (context) => [
          for (final mode in askModes)
            PopupMenuItem<String>(value: mode, child: Text(t('ask.mode.$mode'))),
        ],
        child: Chip(
          label: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(t(goal.labelKey)),
              const SizedBox(width: 4),
              const Icon(Icons.arrow_drop_down, size: 18),
            ],
          ),
          visualDensity: VisualDensity.compact,
        ),
      ),
    );
  }

  Widget _note(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Text(text, style: Theme.of(context).textTheme.bodySmall),
      );

  Widget _composer(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_embedDown)
            Text(t('ask.embedFallback'), style: theme.textTheme.bodySmall),
          if (_errorKey.isNotEmpty)
            Text(t(_errorKey),
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error)),
          if (_quota != null && !_quota!.isReached)
            Text(t('ask.quotaLeft', {'n': '${_quota!.remaining}'}),
                style: theme.textTheme.bodySmall),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _input,
                  maxLength: 2000,
                  minLines: 1,
                  maxLines: 4,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: t('ask.placeholder'),
                    counterText: '',
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _streaming
                  ? FilledButton.tonal(onPressed: _stop, child: Text(t('ask.stop')))
                  : FilledButton(
                      onPressed: _canSend ? () => _send() : null,
                      child: Text(t('ask.send')),
                    ),
            ],
          ),
          if (_quota?.isReached ?? false)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(t('ask.quotaReached'), style: theme.textTheme.bodySmall),
            ),
        ],
      ),
    );
  }
}

Future<void> showAskSheet(BuildContext context, AppState state) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => AskSheet(state: state),
  );
}

