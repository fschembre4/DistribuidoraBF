CREATE TABLE productos (
  id SERIAL PRIMARY KEY,
  ref_id INTEGER NOT NULL,
  lista TEXT NOT NULL CHECK (lista IN ('mayor', 'detal')),
  categoria TEXT NOT NULL DEFAULT '',
  nombre TEXT NOT NULL DEFAULT '',
  empaque TEXT NOT NULL DEFAULT '',
  presentacion TEXT NOT NULL DEFAULT '',
  precio NUMERIC(10,2) NOT NULL DEFAULT 0,
  disponible BOOLEAN NOT NULL DEFAULT true,
  utilidad NUMERIC(5,2) NOT NULL DEFAULT 0,
  etiqueta TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lista, ref_id)
);

CREATE INDEX idx_productos_lista ON productos(lista);
CREATE INDEX idx_productos_categoria ON productos(categoria);
CREATE INDEX idx_productos_nombre ON productos(nombre);

CREATE TABLE pedidos (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL DEFAULT '',
  cliente TEXT NOT NULL DEFAULT 'Cliente',
  total_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_bs NUMERIC(10,2) NOT NULL DEFAULT 0,
  modo TEXT NOT NULL DEFAULT 'DIVISA' CHECK (modo IN ('DIVISA', 'BCV')),
  nota TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pedido_items (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  ref_id INTEGER NOT NULL DEFAULT 0,
  nombre TEXT NOT NULL DEFAULT '',
  presentacion TEXT NOT NULL DEFAULT '',
  empaque TEXT NOT NULL DEFAULT '',
  precio NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  lista TEXT NOT NULL DEFAULT 'mayor'
);

CREATE INDEX idx_pedido_items_pedido_id ON pedido_items(pedido_id);

CREATE TABLE configuracion (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tasa_bcv NUMERIC(10,4) NOT NULL DEFAULT 0,
  diferencial NUMERIC(5,1) NOT NULL DEFAULT 0,
  ultima_actualizacion TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO configuracion (id, tasa_bcv, diferencial) VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;
