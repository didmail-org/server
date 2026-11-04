CREATE TABLE template_cache_scopes (scope TEXT PRIMARY KEY, generation INTEGER NOT NULL DEFAULT 0);
CREATE TABLE template_list_cache (scope TEXT NOT NULL, cursor TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (scope, cursor));
