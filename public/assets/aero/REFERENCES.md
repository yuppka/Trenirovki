# Aero — референсы

Сохранить файлы-референсы в `refs/` не удалось: политика сети этого окружения блокирует
`www.pinterest.com`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.deviantart.com`, `huggingface.co`.
Папка `refs/` в `.gitignore`, пустая. Ниже — опорные источники (ссылки для просмотра) и что из каждого взято.

| # | Источник | Что взято |
|---|---|---|
| 1 | Windows Vista / 7 Aero: окно с прозрачной рамкой — https://en.wikipedia.org/wiki/Windows_Aero | стеклянная рамка с внутренней белой подсветкой по краю, блик в верхней половине заголовка, тёмный контур 1 px |
| 2 | 7.css (точная реконструкция окон Windows 7) — https://khang-nd.github.io/7.css/ | градиенты рамки `#4580C4` + белые полосы-«разводы», кнопка закрытия (красный глянец), серебристые кнопки `#F2F2F2 → #CFCFCF`, наведение `#EAF6FD → #A7D9F5` |
| 3 | Frutiger Aero (обзор эстетики) — https://aesthetics.fandom.com/wiki/Frutiger_Aero | палитра «небо + вода + белый», пузыри, лучи света, глянец |
| 4 | Wii Menu — https://en.wikipedia.org/wiki/Wii_Menu | белые карточки-«каналы» со скруглением, светлый фон, голубой акцент |
| 5 | PS3 XrossMediaBar (XMB) — https://en.wikipedia.org/wiki/XrossMediaBar | волнистые светящиеся ленты по горизонтали на градиентном фоне |
| 6 | Xbox 360 Blades — https://en.wikipedia.org/wiki/Xbox_360_system_software | вкладки-лезвия, яркий акцент активного раздела (подчёркивание вкладок) |
| 7 | Windows Vista: кнопка «Пуск» (орб) — https://en.wikipedia.org/wiki/Start_menu | круглая глянцевая кнопка с радиальным градиентом → кнопка «+» и активная иконка навигации |
| 8 | Windows Vista: всплывающие подсказки (tooltip) | светло-жёлтый фон `#FFFFE1`, серая рамка → тосты |
| 9 | Windows Vista: поля ввода | белое поле, рамка `#ABADB3`, голубая подсветка фокуса |
| 10 | Aqua-кнопки Mac OS X / Vista (glossy pill) | пилюля: светлая верхняя половина, резкий перелом на 50 %, насыщенная нижняя |

Палитра Aero в `src/styles/theme.css`: небо `#0F8FD9 → #E4F7FF`, акцент `#0E92D8`, глубокий `#075A94`, текст `#0B2540`.
