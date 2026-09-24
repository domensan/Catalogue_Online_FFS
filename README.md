# Catálogo FFS 2027

Visor estático de las 48 páginas originales: animación de libro con StPageFlip, arrastre, botones, flechas del teclado, doble página en escritorio y página individual en móvil. No requiere frameworks, npm ni servidor de aplicación.

## Ejecutar localmente

Se necesita Python 3:

```sh
python3 scripts/build.py
python3 -m http.server 8000 --directory _site
```

Abrir http://localhost:8000. Usar un servidor HTTP; abrir el HTML directamente con `file://` no permite leer el manifiesto JSON.

## Agregar o actualizar páginas

Colocar o reemplazar los PNG en `img/` con nombres consecutivos:

```text
Cat_FFS_2027_V2_Página_01.png
Cat_FFS_2027_V2_Página_02.png
...
Cat_FFS_2027_V2_Página_48.png
Cat_FFS_2027_V2_Página_49.png
```

No modificar HTML ni JavaScript ni mantener un número de páginas manualmente. El generador descubre las imágenes en orden numérico y conserva su nombre Unicode exacto, tanto si la tilde viene compuesta como descompuesta desde macOS. La numeración debe comenzar en 01, sin huecos ni duplicados. Mantener la misma proporción de página. El contenido del catálogo procede únicamente de los PNG originales.

En local, repetir `python3 scripts/build.py` después de cambiar imágenes. Al subir los cambios a `main`, GitHub Actions genera automáticamente `pages.json` y publica el sitio actualizado. `pages.json` es generado, no se edita a mano. `_site/` es descartable y no se versiona.

```sh
python3 scripts/check.py
python3 scripts/build.py
git add img pages.json
git commit -m "Actualizar páginas del catálogo"
git push origin main
```

## GitHub Pages

Repositorio: https://github.com/domensan/Catalogue_Online_FFS

URL prevista: https://domensan.github.io/Catalogue_Online_FFS/

En **Settings → Pages → Build and deployment → Source**, seleccionar **GitHub Actions**. El flujo `.github/workflows/pages.yml` valida las imágenes, genera `_site/` y lo publica en cada push a `main`. También puede ejecutarse manualmente desde **Actions → Publicar catálogo → Run workflow**. El sitio usa rutas relativas para funcionar bajo el subdirectorio del repositorio.

## Carga y accesibilidad

Solo se asigna una URL a la página actual y a un grupo cercano de páginas; las demás no se descargan hasta acercarse a ellas. Las páginas ya cargadas se conservan para poder retroceder. No se modifican ni recomprimen las imágenes originales. La velocidad de descarga de cada página depende del tamaño de su PNG.

Los botones tienen etiquetas accesibles, el contador anuncia la página actual y se respeta la preferencia de movimiento reducido. En una vista doble, el contador señala la primera página visible. El texto dentro de las imágenes no puede ser interpretado por lectores de pantalla; sería necesario proporcionar una transcripción para ofrecer ese contenido de forma accesible.

## Librería

[StPageFlip 2.0.7](https://github.com/Nodlik/StPageFlip), distribuida localmente en `vendor/page-flip.browser.js`, sin dependencias ni CDN en tiempo de ejecución. Licencia MIT incluida en `vendor/StPageFlip-LICENSE`.

## Comentarios compartidos en Google Sheets

Pulsa **Review mode**, espera que carguen los comentarios y selecciona un punto de la página. Escribe tu nombre y comentario, y pulsa **Save**. El visor confirma el guardado solo cuando Apps Script responde correctamente. **Refresh comments** recupera las notas de otros revisores. No hay actualización en tiempo real.

Los comentarios se guardan en la pestaña **Comments** de la planilla privada del propietario. Cualquier visitante del catálogo puede leerlos y agregar notas; los nombres son declarados, no verificados. Las notas publicadas son de solo lectura en el catálogo. El propietario puede corregirlas, eliminar filas o cambiar **Status** a **Resolved** (resuelto) u **Open** (pendiente) directamente en Sheets. No cambiar los encabezados ni los IDs. Las posiciones X/Y son proporciones entre 0 y 1.

La planilla es https://docs.google.com/spreadsheets/d/1LMfiDG1WuCj6wvtCitj4_iDcCddZ72R1o2OqZFYkLA4/edit. La URL pública de Apps Script está en `review.js`. El código desplegado se conserva en `apps-script/Code.gs`; este archivo no se incluye en `_site/`. La aplicación web se despliega en Apps Script con **Execute as: Me** y **Who has access: Anyone**. Los cambios al código del servidor requieren actualizar la versión del despliegue en Apps Script; el push a GitHub solo publica el visor.

Si falla el envío, el texto permanece en el diálogo. **Retry save** reenvía el mismo ID y contenido, evitando duplicados si Google ya lo guardó pero la respuesta se perdió. No cerrar la pestaña antes de confirmar el guardado. Las notas de la antigua demo local permanecen en el almacenamiento de su navegador; no se publican automáticamente.

Al terminar la revisión se puede archivar el despliegue de Apps Script y conservar la planilla. El servidor valida páginas 1–48; si se agregan más páginas, actualizar ese límite en `validate_` y desplegar una nueva versión. Reemplazar imágenes con otra composición puede cambiar a qué contenido apunta una anotación anterior.

Pruebas: `node scripts/check-apps-script.cjs` valida el servidor con dobles locales; `node scripts/check-review.cjs` prueba el flujo del navegador con respuestas simuladas, sin escribir en Sheets (requiere Playwright y servidor local en 8765).
