// Cliente Supabase falso en memoria para probar la interfaz sin red (ver tests/run.mjs).
// Soporta lo que usa supabase-app.js: from().select/insert/update/delete con filtros, rpc, auth, storage y canales.
window.createMockSupabase = function createMockSupabase(db, options = {}) {
  const { userId, log = [] } = options;
  // Funciones SQL que casi todas las pantallas usan; cada escenario puede reemplazarlas con options.rpc.
  const rpc = {
    follower_counts: async ({ p_startup_id }, data) => {
      const rows = (data.follows || []).filter((follow) => follow.startup_id === p_startup_id);
      const roleOf = (id) => (data.profiles || []).find((item) => item.id === id)?.role;
      return [{ total: rows.length, investors: rows.filter((row) => roleOf(row.follower_id) === "investor").length, companies: rows.filter((row) => roleOf(row.follower_id) === "company").length }];
    },
    pro_user_ids: async ({ p_ids }, data) => (data.pro_ids || []).filter((id) => p_ids.includes(id)),
    record_profile_view: async () => null,
    startup_view_stats: async (_args, data) => (data.view_stats ? [data.view_stats] : { __error: "FEATURE_LOCKED: las estadísticas de visitas son una función Pro" }),
    ...(options.rpc || {})
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  let ids = 1000;
  // Valores por defecto de la base (las columnas con DEFAULT en las migraciones).
  const DEFAULTS = { company_challenges: { status: "open" }, funding_rounds: { status: "draft", committed_pct: 0 }, posts: { category: "hito" }, interests: { status: "pending" } };
  function builder(table) {
    const state = { filters: [], op: "select", payload: null, order: null, max: null, single: null, returning: false };
    const api = {};
    const add = (fn) => (...args) => { state.filters.push((row) => fn(row, ...args)); return api; };
    Object.assign(api, {
      select() { state.returning = true; return api; },
      insert(payload) { state.op = "insert"; state.payload = payload; return api; },
      update(payload) { state.op = "update"; state.payload = payload; return api; },
      delete() { state.op = "delete"; return api; },
      eq: add((row, key, value) => row[key] === value),
      neq: add((row, key, value) => row[key] !== value),
      in: add((row, key, values) => values.includes(row[key])),
      is: add((row, key, value) => (row[key] ?? null) === value),
      gte: add((row, key, value) => row[key] >= value),
      ilike: add((row, key, value) => String(row[key] ?? "").toLowerCase().includes(value.replace(/%/g, "").toLowerCase())),
      order(key, { ascending = true } = {}) { state.order = [key, ascending]; return api; },
      limit(count) { state.max = count; return api; },
      range(from, to) { state.max = to - from + 1; state.from = from; return api; },
      single() { state.single = "one"; return api; },
      maybeSingle() { state.single = "maybe"; return api; },
      then(resolve, reject) { return Promise.resolve().then(run).then(resolve, reject); }
    });
    function run() {
      log.push({ table, op: state.op, payload: state.payload, filters: state.filters.length });
      const rows = (db[table] ||= []);
      let result;
      if (state.op === "insert") {
        const incoming = [].concat(state.payload).map((row) => ({ id: `id-${ids++}`, created_at: new Date().toISOString(), ...DEFAULTS[table], ...clone(row) }));
        const unique = options.unique?.[table];
        if (unique && incoming.some((row) => rows.some((other) => unique.every((key) => other[key] === row[key])))) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        if (options.reject?.[table]) return { data: null, error: { code: "42501", message: options.reject[table] } };
        rows.push(...incoming);
        result = incoming;
      } else {
        const matching = rows.filter((row) => state.filters.every((test) => test(row)));
        if (state.op === "update") matching.forEach((row) => Object.assign(row, clone(state.payload)));
        if (state.op === "delete") db[table] = rows.filter((row) => !matching.includes(row));
        result = matching;
      }
      if (state.order) {
        const [key, ascending] = state.order;
        result = [...result].sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * (ascending ? 1 : -1));
      }
      if (state.from) result = result.slice(state.from);
      if (state.max) result = result.slice(0, state.max);
      result = clone(result);
      if (state.single === "one") return result.length === 1 ? { data: result[0], error: null } : { data: null, error: { message: "single row expected" } };
      if (state.single === "maybe") return { data: result[0] ?? null, error: null };
      return { data: result, error: null };
    }
    return api;
  }
  const channels = [];
  const session = userId ? { user: { id: userId, email: `${userId}@test.cl` } } : null;
  const client = {
    from: builder,
    rpc: async (name, args) => {
      log.push({ rpc: name, args });
      if (!rpc[name]) return { data: null, error: { message: `rpc ${name} no simulada` } };
      const result = await rpc[name](args, db);
      if (result && result.__error) return { data: null, error: { message: result.__error } };
      return { data: result, error: null };
    },
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => { log.push({ signOut: true }); return { error: null }; },
      signInWithPassword: async () => ({ data: { user: session?.user }, error: null }),
      signUp: async () => ({ data: { user: session?.user, session }, error: null })
    },
    storage: {
      from: (bucket) => ({
        upload: async (path, file) => { log.push({ upload: bucket, path, size: file.size, type: file.type }); return { data: { path }, error: null }; },
        getPublicUrl: (path) => ({ data: { publicUrl: `https://files.test/${bucket}/${path}` } })
      })
    },
    channel: (name) => {
      const channel = { name, handlers: [], on(_type, _filter, handler) { channel.handlers.push(handler); return channel; }, subscribe(cb) { cb?.(options.realtimeStatus || "SUBSCRIBED"); return channel; } };
      channels.push(channel);
      return channel;
    },
    removeChannel: async () => {},
    __channels: channels
  };
  return client;
};
