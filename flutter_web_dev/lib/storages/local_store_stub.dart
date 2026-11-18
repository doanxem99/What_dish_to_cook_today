///Non-web fallback: values live for the process only.
final Map<String, String> _memory = {};

String? readKey(String key) => _memory[key];

void writeKey(String key, String value) => _memory[key] = value;
