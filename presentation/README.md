# Материалы защиты

Порядок показа — `../START_HERE.md`. PPTX содержит 14 слайдов с редактируемыми текстами, таблицами, схемой и встроенным MP4; скриншоты и фотографии — изображения. PDF содержит статичную обложку вместо видео, шрифты внедрены. MP4 H.264/yuv420p без звука открывается отдельно. QR ведут на рабочий сайт и полное видео.

Материалы доступны по `/materials/FairRound.pdf`, `/materials/FairRound.pptx`, `/materials/FairRound-demo.mp4` и `/materials/FairRound-demo-short.mp4` на HTTPS-стенде.

Название команды есть во вступлении речи, состав — на слайде 14. Microsoft PowerPoint на машине сборки отсутствует: структура PPTX, внедрение видео и конвертация LibreOffice проверены, воспроизведение встроенного видео в PowerPoint проверить на ПК выступающего. В PDF видео не воспроизводится; открыть MP4 отдельно.

## Воспроизведение сборки

Из корня репозитория после `pnpm install`: `node presentation/build/build.cjs`, `python presentation/build/grayscale.py`. Это создаёт PPTX. Для PDF повторите генерацию с переменной `PDF_STATIC=1`, примените `python presentation/build/grayscale.py FairRound-static.pptx`, конвертируйте LibreOffice в PDF и переименуйте результат в FairRound.pdf. Dockerfile LibreOffice и шрифты находятся в build/ и assets/fonts. Нужны Node22 и Python3; зависимости pptxgenjs4/qrcode закреплены lockfile.

Сборка видео описана в VIDEO.md. Сначала убедитесь, что демонстрационные аккаунты и туры доступны: захват совершает настоящие действия и создаёт данные. Исходные фотографии и лицензии — CREDITS.md. Не используйте секретный handover в качестве раздаточного материала.


После приёмки: полный воспроизводимый экспорт одной командой из корня — `python presentation/build/export.py` (нужны PyMuPDF и Pillow, Node/pnpm-зависимости, Docker). Скрипт измеряет исходные размеры изображений, сохраняет пропорции, собирает PDF со статичным видео, рендерит 14 превью, создаёт обложку и внедряет MP4 в PPTX. Публичная раздача — `python scripts/publish-materials.py`; это только четыре разрешённых файла, не handover.
