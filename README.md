# Mundial Local

Dashboard local de partidos del Mundial 2026 hecho con Vite. Consume la programación pública de OpenFootball desde el navegador, incluye una copia local de respaldo servida por Vite y guarda filtros en `localStorage`.

No usa Docker, no usa `docker-compose`, no crea backend y no requiere Elasticsearch ni base de datos.

## Requisitos

- Node.js
- npm

## Desarrollo

```bash
npm install
cp .env.example .env
# Completar VITE_BALLDONTLIE_API_KEY en .env
npm run dev -- --host 0.0.0.0
```

Vite mostrará una URL local, normalmente `http://localhost:5173`.

## Funcionalidad

- Programación real desde `https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json`
- Fallback local en `public/fixture/worldcup-2026.json`
- Todos los horarios se muestran en hora de Argentina
- Selector de fecha, botón Hoy y botón Próximo
- Filtro Solo importantes
- Buscador por equipo
- Resultados consultados al abrir desde la API pública de ESPN
- Estados Programado, En vivo y Finalizado
- Tabla de posiciones recalculada automáticamente con resultados finalizados
- Caché de última consulta en `localStorage` y fallback local
- Estados de carga y error
- Cards mobile con hora argentina, grupo/ronda, sede y badge Importante
- Persistencia en `localStorage` de equipos importantes, tema y filtro Solo importantes
- Convocados 2026 desde `src/data/squads-2026-app.json`, enriquecidos con ESPN y con BALLDONTLIE opcional

## Uso local desde el celular

1. Verificar que Node.js y npm estén instalados:

   ```bash
   node --version
   npm --version
   ```

2. Instalar dependencias:

   ```bash
   npm install
   ```

3. Correr Vite escuchando en todas las interfaces de red:

   ```bash
   npm run dev -- --host 0.0.0.0
   ```

4. Obtener la IP local de la PC:

   ```bash
   hostname -I
   ```

   Si el comando anterior no está disponible, usar:

   ```bash
   ip a
   ```

5. Abrir la app desde el celular conectado a la misma red WiFi usando la IP local de la PC y el puerto de Vite. Ejemplo:

   ```text
   http://192.168.1.50:5173
   ```

La app puede instalarse como PWA desde navegadores compatibles.
# mundial-2026
