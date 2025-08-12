# GGRoom — Дуэль 1 на 1 (статический MVP)

Добавлены страницы:
- `/duel.html` — выбор ставки.
- `/duel-room.html` — комната ожидания.

Новые директории:
- `/css/duel.css`
- `/js/duel.js`
- `/assets/final-table.png` — баннер (переименовано из вашего png)
- `/assets/challenges.png` — сетка из 6 карточек (временный вариант с масками)

## Как подключить из лобби
Замените блок с тремя карточками на одну ссылку:
```html
<a href="/duel.html" class="btn btn-primary">Дуэль 1 на 1</a>
```
или используйте файл `_example_lobby.html` как ориентир верстки блока.

## Картинки на проде
Рекомендовано заменить `challenges.png` на набор из 6 отдельных PNG/WebP без лейблов и убрать оверлеи из CSS.
Имена, которые можно использовать:
- `coins.png`, `wallet.png`, `sack.png`, `chest-s.png`, `chest-m.png`, `chest-l.png`

И положить их сюда: `/assets/`.
После этого в `css/duel.css` заменить `.bg-1..bg-6` на `background-image: url("/assets/coins.png")` и т.д.
