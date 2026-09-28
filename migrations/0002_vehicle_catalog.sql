-- Independent public catalog; never modifies customer or vehicle tables.
CREATE TABLE vehicle_catalog_sources (id TEXT PRIMARY KEY, repository TEXT NOT NULL, source_commit TEXT NOT NULL, license TEXT NOT NULL, imported_at TEXT NOT NULL, sha256 TEXT NOT NULL);
CREATE TABLE vehicle_makes (id TEXT PRIMARY KEY, name TEXT NOT NULL, search_key TEXT NOT NULL, country TEXT, source_id TEXT NOT NULL, source TEXT NOT NULL REFERENCES vehicle_catalog_sources(id), active INTEGER NOT NULL DEFAULT 1);
CREATE INDEX vehicle_makes_search ON vehicle_makes(search_key);
CREATE TABLE vehicle_models (id TEXT PRIMARY KEY, make_id TEXT NOT NULL REFERENCES vehicle_makes(id), name TEXT NOT NULL, search_key TEXT NOT NULL, year_start INTEGER, year_end INTEGER, source_id TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE INDEX vehicle_models_make_search ON vehicle_models(make_id,search_key);
CREATE TABLE vehicle_generations (id TEXT PRIMARY KEY, model_id TEXT NOT NULL REFERENCES vehicle_models(id), name TEXT NOT NULL, search_key TEXT NOT NULL, year_start INTEGER, year_end INTEGER, body_type TEXT, source_id TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE INDEX vehicle_generations_model_year ON vehicle_generations(model_id,year_start,year_end);
CREATE TABLE vehicle_engines (id TEXT PRIMARY KEY, generation_id TEXT NOT NULL REFERENCES vehicle_generations(id), name TEXT NOT NULL, search_key TEXT NOT NULL, fuel TEXT, displacement REAL, power REAL, transmission TEXT, drive TEXT, cylinders INTEGER, source_id TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE INDEX vehicle_engines_generation ON vehicle_engines(generation_id,search_key);
CREATE TABLE vehicle_model_years (model_id TEXT NOT NULL REFERENCES vehicle_models(id), year INTEGER NOT NULL CHECK(year BETWEEN 1886 AND 2100), PRIMARY KEY(model_id,year));
CREATE INDEX vehicle_model_years_year ON vehicle_model_years(year,model_id);
