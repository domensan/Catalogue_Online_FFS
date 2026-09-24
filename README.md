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

## Demo local de anotaciones

Pulsa **Review mode** y luego un punto de la página. Escribe y guarda tu comentario: aparecerá un marcador numerado. Pulsa un marcador para editar, resolver/reabrir o eliminar la nota. Pulsa Escape o Cancel para descartar lo que no hayas guardado. En revisión, usa los botones anterior/siguiente para navegar; las páginas no se arrastran. También puedes enfocar una página con Tab y pulsar Intro para comentar en su centro.

Las notas se guardan en `localStorage`, solo en ese navegador y dirección local. No se envían a un servidor ni se comparten entre equipos. Borrar los datos del sitio elimina las notas. Esta demo no incorpora cuentas ni control de acceso. Los puntos se guardan como posiciones proporcionales; reemplazar una imagen con otra composición puede desalinear el comentario respecto del contenido.

Comprobación opcional de la demo con Playwright disponible en Node: `node scripts/check-review.cjs` (servidor local en el puerto 8765).
