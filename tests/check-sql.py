"""Valida la sintaxis de cada migración con el parser real de PostgreSQL (pip install pglast)."""
import glob, sys
from pglast import parse_sql
bad = 0
for path in sorted(glob.glob("supabase/migrations/*.sql")) + glob.glob("supabase/seed.sql"):
    try:
        n = len(parse_sql(open(path, encoding="utf-8").read()))
        print(f"ok  {path} ({n} sentencias)")
    except Exception as e:
        bad += 1
        print(f"ERR {path}: {e}")
sys.exit(1 if bad else 0)
