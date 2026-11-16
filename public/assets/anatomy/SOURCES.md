# Анатомическая схема — источники

| Что | Ссылка | Автор | Лицензия | Что изменено |
|---|---|---|---|---|
| Полигоны мышечной карты, вид спереди и сзади (viewBox 100×200) | https://github.com/GV79/react-body-highlighter (npm `react-body-highlighter` 2.0.5, `src/assets/index.ts`) | GV79 | MIT, © 2020 GV79 | точки перенесены без изменений в `src/ui/anatomy-data.js`; области переименованы под справочник мышц; библиотечные «abductors/abductor» лежат на внутренней поверхности бедра и отнесены к **приводящим**; передняя «neck» отнесена к трапециям (верхние пучки видны спереди); добавлены свои полигоны: **отводящие** (наружная поверхность таза, спереди и сзади) и **ромбовидные** (между позвоночником и лопатками, под трапецией — без подсветки рисуются пунктирным контуром); грудь разрезана по высоте на верх/середину/низ, дельты — по ширине (спереди: передняя/средняя, сзади: задняя/средняя) через `clipPath` в `src/ui/anatomy.js` |

Пакет в проект не добавлен: данные встроены инлайн, схема работает офлайн и без CDN.
Силуэт нейтральный: только контуры и заливки мышечных областей, без лица и анатомических деталей.

MIT License — Copyright (c) 2020 GV79. Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files, to deal in the Software without restriction, including the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies, subject to the inclusion of this notice.

## 3D-манекен — `mannequin.glb`

| Что | Ссылка | Автор | Лицензия | Что изменено |
|---|---|---|---|---|
| Мышцы тела (`MuscularSystem100.fbx`) и поверхность головы, кистей и стоп (`Regions of human body100.fbx`) | https://github.com/LluisV/Z-Anatomy (ветка `PC-Version`, `Resources/Models/FBX`) | модели проекта Z-Anatomy; репозиторий — Lluís Vinent Juanico | CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/ | из 686 мешей мышц оставлены поверхностные; 20 групп объединены в объекты с id мышц из `src/core/muscles.js` (правила — в `tools/build-mannequin.py`); остальные видимые мышцы, голова, кисти и стопы слиты в нейтральный объект `_body`; сетка упрощена с 2,1 млн до ~65 тыс. треугольников; удалены материалы, UV и нормали (нормали считаются при загрузке); экспорт в GLB |

Производная модель `mannequin.glb` распространяется на тех же условиях — **CC BY-SA 4.0**; на код приложения эта лицензия не распространяется.
Z-Anatomy, по описанию проекта, основан на данных BodyParts3D (© The Database Center for Life Science, CC BY-SA 2.1 Japan) — этот кредит сохранён. Связь Z-Anatomy с BodyParts3D в этой работе по первоисточнику не проверялась.

Пересборка: Blender 5.2, `blender --background --factory-startup --python tools/build-mannequin.py -- MuscularSystem100.fbx "Regions of human body100.fbx" mannequin.glb report.json`.
Исходные FBX в репозиторий не добавлены (37 и 4 МБ).
