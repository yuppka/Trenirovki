# Анатомическая схема — источники

| Что | Ссылка | Автор | Лицензия | Что изменено |
|---|---|---|---|---|
| Полигоны мышечной карты, вид спереди и сзади (viewBox 100×200) | https://github.com/GV79/react-body-highlighter (npm `react-body-highlighter` 2.0.5, `src/assets/index.ts`) | GV79 | MIT, © 2020 GV79 | точки перенесены без изменений в `src/ui/anatomy-data.js`; области переименованы под справочник мышц; библиотечные «abductors/abductor» лежат на внутренней поверхности бедра и отнесены к **приводящим**; передняя «neck» отнесена к трапециям (верхние пучки видны спереди); добавлены свои полигоны: **отводящие** (наружная поверхность таза, спереди и сзади) и **ромбовидные** (между позвоночником и лопатками, под трапецией — без подсветки рисуются пунктирным контуром); грудь разрезана по высоте на верх/середину/низ, дельты — по ширине (спереди: передняя/средняя, сзади: задняя/средняя) через `clipPath` в `src/ui/anatomy.js` |

Пакет в проект не добавлен: данные встроены инлайн, схема работает офлайн и без CDN.
Силуэт нейтральный: только контуры и заливки мышечных областей, без лица и анатомических деталей.

MIT License — Copyright (c) 2020 GV79. Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files, to deal in the Software without restriction, including the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies, subject to the inclusion of this notice.
