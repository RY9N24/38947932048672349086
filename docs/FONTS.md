# Шрифты

Официальные полные WOFF2 IBM Plex сохранены в `apps/web/app/fonts/`, подключены через `next/font/local`. В каждом файле проверены латинские и кириллические глифы.

Источники: npm-пакеты издателя IBM: `@ibm/plex-sans@1.1.0`, `@ibm/plex-sans-condensed@2.0.0`, `@ibm/plex-mono@2.5.0`. Лицензия OFL в `apps/web/app/fonts/LICENSE.txt`.

В Google Fonts / Fontsource на момент проверки устаревший Condensed не содержал базовой кириллицы; браузер подставлял системный шрифт. В [официальном выпуске IBM](https://github.com/IBM/plex/releases/tag/@ibm%2Fplex-sans-condensed@2.0.0) кириллица добавлена. Поэтому пакет Fontsource заменён официальными полными файлами.

Для PDF/PPTX эти же WOFF2 декодированы FontTools в исходный OpenType-формат, без изменения дизайна и имён. Файлы для установки находятся в `presentation/assets/fonts/`.
