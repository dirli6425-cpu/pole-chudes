CREATE TABLE IF NOT EXISTS game_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO game_config (id, payload) VALUES (1, '{"groups": ["102", "103", "104"], "rounds": [{"q": "Как называется прибор для измерения температуры?", "a": "ТЕРМОМЕТР"}, {"q": "Как называется строительный материал, получаемый обжигом глины?", "a": "КИРПИЧ"}, {"q": "Как называется химическая посуда для проведения опытов?", "a": "КОЛБА"}, {"q": "Как называется инструмент для проверки горизонтальности поверхности?", "a": "УРОВЕНЬ"}, {"q": "Как называется вещество, ускоряющее химическую реакцию?", "a": "КАТАЛИЗАТОР"}]}');
