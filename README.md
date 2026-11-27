# Evisual

Editor de PDF para ingeniería civil y para el público en general: planos y documentos en una sola app, con una interfaz limpia y profesional. Todo se procesa en tu equipo; ningún documento se sube a internet.

## Instalar en Windows

1. Entra en [Releases](https://github.com/darynla2198-lopez/Evisual/releases/latest) y descarga `Evisual-Setup-<versión>.exe`.
2. Ábrelo y sigue el asistente. Evisual queda en el menú Inicio, en el escritorio y como programa para abrir PDFs.
3. Para abrir PDFs con doble clic: clic derecho en un PDF > Abrir con > Evisual > "Usar siempre esta aplicación".
4. Las actualizaciones son automáticas: Evisual busca al abrir y cada 3 horas, descarga en segundo plano y se instala en silencio (sin asistente) al cerrar o al pulsar **Reiniciar ahora**.

Windows puede mostrar el aviso de SmartScreen la primera vez porque el instalador aún no tiene firma digital: pulsa "Más información" > "Ejecutar de todas formas".

## Usar en la web o instalar desde el navegador

Con GitHub Pages activado, Evisual está en `https://darynla2198-lopez.github.io/Evisual/`. En Edge o Chrome, pulsa **Instalar Evisual** en la barra de direcciones para tenerla como app, sin conexión.

## Funciones

- **Archivos**: abrir varios PDFs en pestañas, Guardar (Ctrl+S) sobre el mismo archivo, Guardar como (Mayús + clic o Ctrl+Mayús+S), aviso de cambios sin guardar, abrir PDFs con contraseña en modo lectura.
- **Ver**: miniaturas que se pueden ocultar, zoom, vista dividida con dos documentos, tema claro, oscuro o automático.
- **Editar**: texto existente (se reemplaza de verdad, sin recuadros) y texto nuevo, con más de 20 tipos de letra, negrita, cursiva, subrayado, tachado, tamaños, colores y alineación; comentarios y resaltado.
- **Páginas**: arrastrar para ordenar, duplicar, girar, insertar, extraer, eliminar y recortar; unir PDFs con un color por documento.
- **Ingeniería**: foliado automático (por rango de numeración, desde cualquier página o de atrás hacia adelante) o manual, con número en letras y letras especiales de numerador, máquina de escribir, esténcil y sello, encabezado y pie, marcas de agua, medición de distancias y áreas a escala, capas con consolidación sin pérdida.
- **Firmas y sellos**: dibujados, escritos o cargados desde imagen, con fondo transparente.
- **Seguridad**: contraseña y permisos, censura de información y limpieza de metadatos.
- **Imprimir**: cualquier papel (ISO A y B, carta, oficio, tabloide, ARCH, ANSI, rollos de plotter, sobres o personalizado), escala, color, escala de grises o blanco y negro para planos, calidad hasta 450 ppp.
- **Compartir**: panel de Windows (correo, WhatsApp, Teams, OneDrive, equipos cercanos), correo, copia, y versión liviana opcional.
- **Imágenes**: extraer las imágenes del PDF y guardarlas en PNG o JPG.

## Publicar una actualización

La versión se escribe solo en `package.json`; un script la copia a `sw.js`, `version.json` e `index.html`.

1. Escribe las notas de la versión arriba de `"notes"` en `version.json` (son las que aparecen en Novedades).
2. Ejecuta `npm version 1.0.3`. Copia la versión a todos los archivos, crea el commit y la etiqueta `v1.0.3`.
3. Ejecuta `git push --follow-tags`. GitHub Actions construye el instalador y lo publica en Releases, y las apps instaladas lo detectan solas.

Si cambias la versión a mano, ejecuta `npm run version:sync`. El flujo de publicación se detiene si algún archivo quedó con otra versión.

### Versiones beta

Una versión con guion, como `1.0.3-beta.1`, se publica como "pre-release". Solo la reciben quienes activan **Recibir versiones beta** en Novedades (app de Windows); el resto sigue en la versión estable. Publica las betas desde una rama `beta`, no desde `main`, para que la versión web no las tome.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La app completa |
| `manifest.webmanifest` | Instalación en Windows y apertura de PDFs con doble clic |
| `sw.js` | Funcionamiento sin conexión y actualizaciones |
| `version.json` | Versión publicada y notas de Novedades |
| `icons/` | Iconos de la app |
| `vendor/` | pdf.js, pdf-lib y fontkit incluidos, para funcionar sin internet |
| `fonts/` | Tipos de letra libres que se incrustan en los PDF (ver LICENSES.txt) |
| `desktop/` | Versión de escritorio para Windows (Electron) |
| `package.json` | Configuración del instalador y de las actualizaciones |
| `.github/workflows/release.yml` | Construye y publica el instalador .exe |

## Tecnología

HTML, CSS y JavaScript sin servidor, empaquetado para Windows con Electron, con [pdf.js](https://mozilla.github.io/pdf.js/) 3.11.174 para ver los documentos y [pdf-lib](https://pdf-lib.js.org/) 1.17.1 para modificarlos.
