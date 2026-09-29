# Тренировки

Дневник тренировок: журнал подходов, каталог упражнений, уровни силы по эталонам Strength Level и прогноз роста.
Веб-приложение (PWA) открывается по ссылке на Android и iOS и работает офлайн. Из того же кода собирается нативное приложение через Capacitor.

## Структура

```
index.html              оболочка страницы
src/
  main.js               точка входа
  core/                 данные и расчёты (перенесены из v1 без изменений логики)
    data.js             эталоны, библиотека упражнений, стартовый каталог
    store.js            состояние, localStorage, облако claude.ai
    training.js         тренировки
    calc.js             уровни, прогноз, двойная прогрессия, отчёт
    ai.js               ИИ-разбор
  styles/
    theme.css           дизайн-токены: цвета, шрифты, радиусы, отступы, тени, длительности
    fonts.css           Unbounded и Manrope, локально
    base.css · components.css · screens.css
  ui/                   экраны и компоненты
  motion/motion.js      анимации (GSAP) и режим «Меньше эффектов»
  native/native.js      Capacitor: вибрация, экран не гаснет, статус-бар, «Поделиться»
public/
  assets/               арты (список в public/assets/README.md)
  icons/                иконки PWA
resources/              исходники иконки и сплэша для нативных приложений
android/ ios/           нативные проекты Capacitor
```

## Команды

```bash
npm install
npm run dev         # локальный сервер для разработки
npm run build       # сборка в dist/
npm run preview     # просмотр сборки
```

## Публикация на GitHub Pages

Сайт собирается GitHub Actions (`.github/workflows/deploy.yml`) при каждом пуше в `main`.
Один раз настрой: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Адрес не меняется, данные пользователей в браузере сохраняются (тот же ключ `wd.data.v1`).

## Арты

Загрузи файлы в `public/assets/` с именами из [`public/assets/README.md`](public/assets/README.md). Код менять не нужно.
После пуша сайт пересоберётся, и арты увидят все, кто откроет ссылку.
Данные тренировок хранятся на каждом устройстве отдельно; перенос между устройствами — через «Профиль → Резервная копия».

## Нативные приложения (Capacitor)

```bash
npm run cap:android   # сборка, синхронизация, открыть Android Studio
npm run cap:ios       # сборка, синхронизация, открыть Xcode (нужен macOS)
npm run assets:native # перегенерировать иконки и сплэш из resources/
```

appId `ru.yuppka.trenirovki`. APK/AAB собираются в Android Studio, IPA — в Xcode.
