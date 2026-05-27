const THEME = {
    // ████████████████████████████████████████████████████████
    // ██  brand — COLOR PRINCIPAL (naranja quemado)       ██
    // ██  Botones, header, badges, enlaces, iconos        ██
    // ████████████████████████████████████████████████████████
    brand: {
        50: '#eff6ff',   // Fondos de badges en hover
        100: '#dbeafe',  // Badges de categorías (fondo)
        300: '#93c5fd',  // Focus ring de toggle switch en admin
        400: '#c9521bff', // Textos e iconos brand en MODO OSCURO (dark:text-brand-400)
        500: '#c9521bff', // Botones primarios (naranja unificado con brand-600)
        600: '#c9521bff', // Botones hover, iconos brand, bg-brand-600
        700: '#c9521bff', // Títulos "Distribuidora BF", texto brand modo claro
        800: '#1e40af',  // Icono engranaje admin panel
        900: '#1e3a8a'   // Fondos con opacidad (/30, /40) en modo oscuro
    },
    // ⚠️ brand-500/600/700 son todos NARANJA (#c9521b).
    //    brand-500: botones, focus rings. brand-600: hover, iconos.
    //    brand-700: títulos. Si cambias brand-500 cambias TODOS los botones principales.

    // ████████████████████████████████████████████████████████
    // ██  price — COLOR DE PRECIOS                        ██
    // ██  Solo precios $ y Bs. en el catálogo             ██
    // ████████████████████████████████████████████████████████
    //    Cambiar esto NO afecta botones ni títulos.
    price: {
        light: '#130c09ff', // Precio USD/Bs. en MODO CLARO (text-price-light)
        dark: '#f8e0d4ff'   // Precio USD/Bs. en MODO OSCURO (dark:text-price-dark)
    },

    // ████████████████████████████████████████████████████████
    // ██  dark — FONDOS EN MODO OSCURO                    ██
    // ██  Se usan con: dark:bg-{nombre}                   ██
    // ████████████████████████████████████████████████████████
    dark: {
        main: '#111827',    // Fondo general de la página (body)
        card: '#1f2937',    // Fondo de tarjetas, header, modales, tablas
        surface: '#374151', // Fondo de inputs, selects, contenedores internos
        border: '#4b5563',  // Bordes de inputs, selects, contenedores
        divider: '#374151', // Líneas divisorias entre filas/elementos
        hover: '#374151',   // Hover de filas en tabla, botones de iconos
        rowHover: '#2b3440' // Hover específico de filas en tabla admin
    },

    // ████████████████████████████████████████████████████████
    // ██  darkText — TEXTOS EN MODO OSCURO                 ██
    // ██  Se usan con: dark:text-{nombre}                 ██
    // ████████████████████████████████████████████████████████
    darkText: {
        primary: '#ffffff',   // Texto principal (títulos grandes, contenido)
        secondary: '#e5e7eb', // Títulos secundarios, encabezados de tabla
        muted: '#d1d5db',     // Labels, texto de categorías, badges
        dim: '#9ca3af',       // Texto tenue (placeholders, metadatos)
        faint: '#6b7280'      // Texto muy tenue (IDs, información secundaria)
    },

    // ████████████████████████████████████████████████████████
    // ██  light — FONDOS EN MODO CLARO                    ██
    // ██  Se usan con: bg-{nombre}                        ██
    // ████████████████████████████████████████████████████████
    light: {
        main: '#f3f4f6',  // Fondo general de la página (body)
        card: '#ffffff',  // Fondo de tarjetas, header, modales, tablas
        border: '#d1d5db' // Bordes de inputs, selects, contenedores
    },

    // ████████████████████████████████████████████████████████
    // ██  green — COLOR VERDE SEMÁNTICO                   ██
    // ████████████████████████████████████████████████████████
    green: {
        100: '#dcfce7', // Badge "Nuevo" (fondo), badge estado "Entregado" (fondo claro)
        300: '#86efac', // Texto badge estado en modo oscuro (dark:text-green-300)
        400: '#4ade80', // (no usado actualmente)
        500: '#22c55e', // Botón flotante WhatsApp en catálogo
        600: '#16a34a', // Hover botón WhatsApp, texto "Nuevo" badge
        700: '#15803d', // Badge "Nuevo" (texto modo claro)
        800: '#166534', // Texto badge estado "Entregado" modo claro
        900: '#14532d'  // Fondo badge estado con opacidad en modo oscuro (dark:bg-green-900/40)
    },

    // ████████████████████████████████████████████████████████
    // ██  red — COLOR ROJO SEMÁNTICO                      ██
    // ████████████████████████████████████████████████████████
    red: {
        50: '#fef2f2',  // (no usado actualmente)
        100: '#fee2e2', // Badge "Oferta" y "Agotado" (fondo modo claro)
        400: '#f87171', // (no usado actualmente)
        500: '#ef4444', // Icono eliminar, texto "Agotado"
        600: '#dc2626', // Toast de error (bg-red-600)
        700: '#b91c1c', // Badge "Oferta" (texto modo claro)
        900: '#7f1d1d'  // Fondos con opacidad en hover (dark:hover:bg-red-900/30)
    },

    // ████████████████████████████████████████████████████████
    // ██  amber — COLOR ÁMBAR SEMÁNTICO                   ██
    // ████████████████████████████████████████████████████████
    amber: {
        100: '#fef3c7', // Badge estado "Pendiente" (fondo modo claro)
        300: '#fcd34d', // Texto badge estado "Pendiente" modo oscuro
        500: '#f59e0b', // Borde tarjeta stats "Con Oferta/Nuevo"
        600: '#d97706', // Texto badge "BCV" en admin
        800: '#92400e', // Texto badge estado "Pendiente" modo claro
        900: '#78350f'  // Fondo badge estado con opacidad en modo oscuro (dark:bg-amber-900/40)
    },

    // ████████████████████████████████████████████████████████
    // ██  blue — COLOR AZUL SEMÁNTICO                     ██
    // ████████████████████████████████████████████████████████
    blue: {
        100: '#dbeafe', // Badge estado "Confirmado" (fondo modo claro)
        300: '#93c5fd', // Texto badge estado "Confirmado" modo oscuro
        800: '#1e40af', // Texto badge estado "Confirmado" modo claro
        900: '#1e3a8a'  // Fondo badge estado con opacidad en modo oscuro (dark:bg-blue-900/40)
    },

    // ████████████████████████████████████████████████████████
    // ██  yellow — COLOR AMARILLO                         ██
    // ████████████████████████████████████████████████████████
    yellow: {
        400: '#facc15' // Icono sol en modo oscuro (dark:text-yellow-400)
    }
};
if (typeof window !== 'undefined') window.THEME = THEME;
module.exports = { THEME };


