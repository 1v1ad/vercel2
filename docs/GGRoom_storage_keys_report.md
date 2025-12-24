# GGRoom — карта client-side ключей (localStorage / sessionStorage / cookies)

Сгенерировано автоматически: 2025-12-24 17:36:51.

## localStorage

| Ключ | Назначение | Где | Операции | Вхождений |
|---|---|---|---|---|
| `admin.backend` | База API для админки (URL бэкенда). | frontend | localStorage.getItem, localStorage.removeItem, localStorage.setItem | 3 |
| `admin.pwd` | Пароль админки (хранится в localStorage). | frontend | localStorage.getItem, localStorage.removeItem, localStorage.setItem | 3 |
| `ADMIN_API` | База API для админки (URL бэкенда). | frontend | localStorage.getItem, localStorage.setItem | 25 |
| `admin_api` | База API для админки (URL бэкенда). | frontend | localStorage.getItem, localStorage.setItem | 5 |
| `ADMIN_PWD` | Пароль админки (хранится в localStorage). | frontend | localStorage.getItem, localStorage.setItem | 11 |
| `admin_pwd` | Пароль админки (хранится в localStorage). | frontend | localStorage.getItem, localStorage.setItem, sessionStorage.setItem | 4 |
| `api_base` | База API (URL бэкенда) для клиентского JS. | frontend | localStorage.getItem | 1 |
| `device_id` | Идентификатор устройства (для аналитической склейки / трекинга). | backend, frontend | localStorage.getItem, localStorage.setItem | 16 |
| `gg_device_id` | Идентификатор устройства (для аналитической склейки / трекинга). | frontend | localStorage.getItem | 1 |
| `gg_user` | Кэш пользователя на фронте (данные /me). | backend, frontend | localStorage.getItem, localStorage.setItem | 4 |

### Детализация (файлы/строки)

#### `admin.backend`

База API для админки (URL бэкенда).

| Repo | Файл | Строка | Операция | Фрагмент |
|---|---|---:|---|---|
| frontend | `admin-test/index.html` | 145 | localStorage.getItem | `backend: localStorage.getItem('admin.backend') \|\| DEFAULT_BACKEND,` |
| frontend | `admin-test/index.html` | 157 | localStorage.setItem | `localStorage.setItem('admin.backend', state.backend);` |
| frontend | `admin-test/index.html` | 162 | localStorage.removeItem | `localStorage.removeItem('admin.backend');` |

#### `admin.pwd`

Пароль админки (хранится в localStorage).

| Repo | Файл | Строка | Операция | Фрагмент |
|---|---|---:|---|---|
| frontend | `admin-test/index.html` | 146 | localStorage.getItem | `pwd: localStorage.getItem('admin.pwd') \|\| ''` |
| frontend | `admin-test/index.html` | 158 | localStorage.setItem | `localStorage.setItem('admin.pwd', state.pwd);` |
| frontend | `admin-test/index.html` | 163 | localStorage.removeItem | `localStorage.removeItem('admin.pwd');` |

#### `ADMIN_API`

База API для админки (URL бэкенда).

| Repo | Файл | Строка | Операция | Фрагмент |
|---|---|---:|---|---|
| frontend | `admin/admin-auth-headers.js` | 7 | localStorage.getItem | `const raw = (window.API \|\| localStorage.getItem('ADMIN_API') \|\| '').toString().trim();` |
| frontend | `admin/admin-topup-patch.js` | 12 | localStorage.getItem | `const ls = (localStorage.getItem('admin_api') \|\| localStorage.getItem('ADMIN_API') \|\| '').trim();` |
| frontend | `admin/admin2.js` | 7 | localStorage.getItem | `const raw = (window.API \|\| localStorage.getItem('ADMIN_API') \|\| '').toString().trim();` |
| frontend | `admin/admin2.js` | 76 | localStorage.getItem | `apiEl.value = (localStorage.getItem('ADMIN_API') \|\| '').toString();` |
| frontend | `admin/admin2.js` | 80 | localStorage.setItem | `localStorage.setItem('ADMIN_API', apiEl.value.trim());` |
| frontend | `admin/app.js` | 4 | localStorage.getItem | `const api = (window.API \|\| localStorage.getItem('ADMIN_API') \|\| '').toString().trim();` |
| frontend | `admin/app.js` | 46 | localStorage.getItem | `const API = (localStorage.getItem('ADMIN_API') \|\| '').toString().trim().replace(/\/+$/, '');` |
| frontend | `admin/chart-range.js` | 19 | localStorage.getItem | `return (localStorage.getItem('ADMIN_API') \|\| '').replace(/\/+$/,'');` |
| frontend | `admin/chart.js` | 6 | localStorage.getItem | `const api = () => (localStorage.getItem('ADMIN_API') \|\| window.API \|\| '').replace(/\/+$/,'');` |
| frontend | `admin/finance.js` | 4 | localStorage.getItem | `return (localStorage.getItem('ADMIN_API') \|\| '').toString().trim().replace(/\/+$/,'');` |
| frontend | `admin/index.html` | 395 | localStorage.getItem | `apiEl.value = localStorage.getItem('ADMIN_API') \|\| (window.API \|\| '');` |
| frontend | `admin/index.html` | 399 | localStorage.setItem | `localStorage.setItem('ADMIN_API', apiEl.value.trim());` |
| frontend | `admin/index.html` | 405 | localStorage.getItem | `const API = (localStorage.getItem('ADMIN_API') \|\| '').replace(/\/+$/,'');` |
| frontend | `admin/index.html` | 416 | localStorage.getItem | `const API = (localStorage.getItem('ADMIN_API') \|\| '').replace(/\/+$/,'');` |
| frontend | `admin/index.html` | 447 | localStorage.getItem | `const API = (localStorage.getItem('ADMIN_API') \|\| '').replace(/\/+$/,'');` |
| frontend | `admin/index.html` | 490 | localStorage.getItem | `const API = (localStorage.getItem('ADMIN_API') \|\| '').replace(/\/+$/,'');` |
| frontend | `admin/index.html` | 526 | localStorage.getItem | `const API = (localStorage.getItem('ADMIN_API') \|\| '').replace(/\/+$/,'');` |
| frontend | `admin/index.html` | 536 | localStorage.getItem | `const API = (localStorage.getItem('ADMIN_API') \|\| '').replace(/\/+$/,'');` |
| frontend | `admin/merge-suggest.js` | 3 | localStorage.getItem | `function getApi(){ return (window.API \|\| localStorage.getItem('ADMIN_API') \|\| '').replace(/\/+$/,''); }` |
| frontend | `admin/split.js` | 7 | localStorage.setItem | `if (api) localStorage.setItem('ADMIN_API', api);` |
| frontend | `admin/split.js` | 12 | localStorage.getItem | `function getApi(){ return (localStorage.getItem('ADMIN_API') \|\| $('#api').value \|\| location.origin).replace(/\/$/,''); }` |
| frontend | `admin/split.js` | 119 | localStorage.getItem | `$('#api').value = localStorage.getItem('ADMIN_API') \|\| '';` |
| frontend | `admin/topup.html` | 90 | localStorage.getItem | `const api = localStorage.getItem('ADMIN_API') \|\| localStorage.getItem('admin_api');` |
| frontend | `admin/topup.html` | 104 | localStorage.setItem | `if (api) { localStorage.setItem('ADMIN_API', api); localStorage.setItem('admin_api', api); }` |
| frontend | `admin/topup.js` | 3 | localStorage.getItem | `function getApi(){ return (window.API \|\| localStorage.getItem('ADMIN_API') \|\| '').replace(/\/+$/,''); }` |

#### `admin_api`

База API для админки (URL бэкенда).

| Repo | Файл | Строка | Операция | Фрагмент |
|---|---|---:|---|---|
| frontend | `admin/admin-topup-patch.js` | 12 | localStorage.getItem | `const ls = (localStorage.getItem('admin_api') \|\| localStorage.getItem('ADMIN_API') \|\| '').trim();` |
| frontend | `admin/admin-topup-patch.js` | 64 | localStorage.setItem | `if (api) try { localStorage.setItem('admin_api', api); } catch {}` |
| frontend | `admin/events.js` | 6 | localStorage.getItem | `const v = (localStorage.getItem('admin_api') \|\| '').trim();` |
| frontend | `admin/topup.html` | 90 | localStorage.getItem | `const api = localStorage.getItem('ADMIN_API') \|\| localStorage.getItem('admin_api');` |
| frontend | `admin/topup.html` | 104 | localStorage.setItem | `if (api) { localStorage.setItem('ADMIN_API', api); localStorage.setItem('admin_api', api); }` |

#### `ADMIN_PWD`

Пароль админки (хранится в localStorage).

| Repo | Файл | Строка | Операция | Фрагмент |
|---|---|---:|---|---|
| frontend | `admin/admin-auth-headers.js` | 13 | localStorage.getItem | `return (localStorage.getItem('ADMIN_PWD') \|\| '').toString();` |
| frontend | `admin/admin2.js` | 77 | localStorage.getItem | `pwdEl.value = (localStorage.getItem('ADMIN_PWD') \|\| '').toString();` |
| frontend | `admin/admin2.js` | 81 | localStorage.setItem | `localStorage.setItem('ADMIN_PWD', pwdEl.value);` |
| frontend | `admin/app.js` | 8 | localStorage.getItem | `return (localStorage.getItem('ADMIN_PWD') \|\| '').toString();` |
| frontend | `admin/index.html` | 396 | localStorage.getItem | `pwdEl.value = localStorage.getItem('ADMIN_PWD') \|\| '';` |
| frontend | `admin/index.html` | 400 | localStorage.setItem | `localStorage.setItem('ADMIN_PWD', pwdEl.value);` |
| frontend | `admin/split.js` | 8 | localStorage.setItem | `if (pwd) localStorage.setItem('ADMIN_PWD', pwd);` |
| frontend | `admin/split.js` | 13 | localStorage.getItem | `function getPwd(){ return (localStorage.getItem('ADMIN_PWD') \|\| $('#pwd').value \|\| ''); }` |
| frontend | `admin/split.js` | 120 | localStorage.getItem | `$('#pwd').value = localStorage.getItem('ADMIN_PWD') \|\| '';` |
| frontend | `admin/topup.html` | 91 | localStorage.getItem | `const pwd = localStorage.getItem('ADMIN_PWD') \|\| localStorage.getItem('admin_pwd');` |
| frontend | `admin/topup.html` | 105 | localStorage.setItem | `if (pwd) { localStorage.setItem('ADMIN_PWD', pwd); localStorage.setItem('admin_pwd', pwd); }` |

#### `admin_pwd`

Пароль админки (хранится в localStorage).

| Repo | Файл | Строка | Операция | Фрагмент |
|---|---|---:|---|---|
| frontend | `admin/admin-topup-patch.js` | 18 | localStorage.getItem | `const ls = (localStorage.getItem('admin_pwd') \|\| '').trim();` |
| frontend | `admin/admin-topup-patch.js` | 63 | sessionStorage.setItem | `try { if (pwd) sessionStorage.setItem('admin_pwd', pwd); } catch {}` |
| frontend | `admin/topup.html` | 91 | localStorage.getItem | `const pwd = localStorage.getItem('ADMIN_PWD') \|\| localStorage.getItem('admin_pwd');` |
| frontend | `admin/topup.html` | 105 | localStorage.setItem | `if (pwd) { localStorage.setItem('ADMIN_PWD', pwd); localStorage.setItem('admin_pwd', pwd); }` |

#### `api_base`

База API (URL бэкенда) для клиентского JS.

| Repo | Файл | Строка | Операция | Фрагмент |
|---|---|---:|---|---|
| frontend | `gg-linker.js` | 3 | localStorage.getItem | `function api(){ return (window.API_BASE \|\| localStorage.getItem('api_base') \|\| '').toString().trim().replace(/\/+$/,''); }` |

#### `device_id`

Идентификатор устройства (для аналитической склейки / трекинга).

| Repo | Файл | Строка | Операция | Фрагмент |
|---|---|---:|---|---|
| backend | `js/app.js` | 30 | localStorage.getItem | `let id = localStorage.getItem('device_id');` |
| backend | `js/app.js` | 31 | localStorage.setItem | `if(!id){ id = genUuid(); localStorage.setItem('device_id', id); }` |
| backend | `js/lobby-balance-fix.js` | 10 | localStorage.getItem | `let id = localStorage.getItem('device_id');` |
| backend | `js/lobby-balance-fix.js` | 13 | localStorage.setItem | `localStorage.setItem('device_id', id);` |
| frontend | `gg-linker.js` | 6 | localStorage.getItem | `let id = localStorage.getItem('device_id') \|\| localStorage.getItem('gg_device_id');` |
| frontend | `gg-linker.js` | 8 | localStorage.setItem | `localStorage.setItem('device_id', id);` |
| frontend | `index.html` | 117 | localStorage.getItem | `let id = localStorage.getItem('device_id');` |
| frontend | `index.html` | 122 | localStorage.setItem | `localStorage.setItem('device_id', id);` |
| frontend | `index.html` | 128 | localStorage.setItem | `try{ localStorage.setItem('device_id', id); } catch{}` |
| frontend | `index.original_2025-10-25_18-00-54.html` | 127 | localStorage.getItem | `let id = localStorage.getItem('device_id');` |
| frontend | `index.original_2025-10-25_18-00-54.html` | 132 | localStorage.setItem | `localStorage.setItem('device_id', id);` |
| frontend | `index.original_2025-10-25_18-00-54.html` | 138 | localStorage.setItem | `try{localStorage.setItem('device_id', id);}catch{}` |
| frontend | `js/app.js` | 30 | localStorage.getItem | `let id = localStorage.getItem('device_id');` |
| frontend | `js/app.js` | 31 | localStorage.setItem | `if(!id){ id = genUuid(); localStorage.setItem('device_id', id); }` |
| frontend | `js/lobby-balance-fix.js` | 10 | localStorage.getItem | `let id = localStorage.getItem('device_id');` |
| frontend | `js/lobby-balance-fix.js` | 13 | localStorage.setItem | `localStorage.setItem('device_id', id);` |

#### `gg_device_id`

Идентификатор устройства (для аналитической склейки / трекинга).

| Repo | Файл | Строка | Операция | Фрагмент |
|---|---|---:|---|---|
| frontend | `gg-linker.js` | 6 | localStorage.getItem | `let id = localStorage.getItem('device_id') \|\| localStorage.getItem('gg_device_id');` |

#### `gg_user`

Кэш пользователя на фронте (данные /me).

| Repo | Файл | Строка | Операция | Фрагмент |
|---|---|---:|---|---|
| backend | `js/app.js` | 40 | localStorage.getItem | `const u = JSON.parse(localStorage.getItem('gg_user')\|\|'null');` |
| backend | `js/lobby-balance-fix.js` | 195 | localStorage.setItem | `try{ localStorage.setItem('gg_user', JSON.stringify(u)); }catch(_){}` |
| frontend | `js/app.js` | 40 | localStorage.getItem | `const u = JSON.parse(localStorage.getItem('gg_user')\|\|'null');` |
| frontend | `js/lobby-balance-fix.js` | 223 | localStorage.setItem | `try{ localStorage.setItem('gg_user', JSON.stringify(u)); }catch(_){}` |

## Динамические обращения (не строковый литерал)

| Repo | Файл | Строка | Вызов |
|---|---|---:|---|
| frontend | `admin/admin-auth-headers.js` | 72 | `localStorage.getItem(HUM_KEY)` |
| frontend | `admin/admin-auth-headers.js` | 82 | `localStorage.setItem(HUM_KEY, val ? '1' : '0')` |

## sessionStorage

Обнаружены ключи, но у нас они попали в общий список выше. (Редко используются.)

## Cookies

| Cookie | Где | Вхождений |
|---|---|---:|
| `device_id` | backend, frontend | 10 |
| `link_state` | backend | 1 |
| `sid` | backend | 2 |
| `vk_code_verifier` | backend | 1 |
| `vk_state` | backend | 1 |

### Детализация cookies

#### `device_id`

| Repo | Файл | Строка | Фрагмент |
|---|---|---:|---|
| backend | `js/app.js` | 33 | `document.cookie = 'device_id=' + id + '; Path=/; Max-Age=' + (60*60*24*365) + '; SameSite=Lax';` |
| backend | `js/lobby-balance-fix.js` | 15 | `document.cookie = 'device_id='+id+'; Path=/; Max-Age='+(60*60*24*365)+'; SameSite=Lax';` |
| backend | `src/routes_auth.js` | 124 | `res.cookie('device_id', deviceIdFromQuery, {` |
| frontend | `gg-linker.js` | 9 | `document.cookie = 'device_id='+id+'; Path=/; Max-Age='+31536000+'; SameSite=Lax';` |
| frontend | `index.html` | 124 | `document.cookie = 'device_id=' + id + '; Path=/; Max-Age=' + (60*60*24*365) + '; SameSite=Lax';` |
| frontend | `index.html` | 129 | `document.cookie = 'device_id=' + id + '; Path=/; Max-Age=' + (60*60*24*365) + '; SameSite=Lax';` |
| frontend | `index.original_2025-10-25_18-00-54.html` | 134 | `document.cookie = 'device_id='+id+'; Path=/; Max-Age='+(60*60*24*365)+'; SameSite=Lax';` |
| frontend | `index.original_2025-10-25_18-00-54.html` | 139 | `document.cookie = 'device_id='+id+'; Path=/; Max-Age='+(60*60*24*365)+'; SameSite=Lax';` |
| frontend | `js/app.js` | 33 | `document.cookie = 'device_id=' + id + '; Path=/; Max-Age=' + (60*60*24*365) + '; SameSite=Lax';` |
| frontend | `js/lobby-balance-fix.js` | 15 | `document.cookie = 'device_id='+id+'; Path=/; Max-Age='+(60*60*24*365)+'; SameSite=Lax';` |

#### `link_state`

| Repo | Файл | Строка | Фрагмент |
|---|---|---:|---|
| backend | `src/routes_auth.js` | 140 | `res.cookie('link_state', JSON.stringify(st), { httpOnly:true, sameSite:'lax', secure:true, path:'/', maxAge:15*60*1000 });` |

#### `sid`

| Repo | Файл | Строка | Фрагмент |
|---|---|---:|---|
| backend | `src/routes_auth.js` | 404 | `res.cookie('sid', sessionJwt, {` |
| backend | `src/routes_tg.js` | 192 | `res.cookie('sid', jwtStr, { httpOnly:true, sameSite:'none', secure:true, path:'/', maxAge:30*24*3600*1000 });` |

#### `vk_code_verifier`

| Repo | Файл | Строка | Фрагмент |
|---|---|---:|---|
| backend | `src/routes_auth.js` | 148 | `res.cookie('vk_code_verifier', codeVerifier,  { httpOnly:true, sameSite:'lax', secure:true, path:'/', maxAge:10*60*1000 });` |

#### `vk_state`

| Repo | Файл | Строка | Фрагмент |
|---|---|---:|---|
| backend | `src/routes_auth.js` | 147 | `res.cookie('vk_state', state,                 { httpOnly:true, sameSite:'lax', secure:true, path:'/', maxAge:10*60*1000 });` |

## Рекомендации по «карте проекта»

- Держать один файл `docs/PROJECT_MAP.md`: где какой экран/скрипт, какие API-эндпойнты дергает, какие localStorage/cookies использует.
- Любую новую фичу добавляем вместе с 2 строками в этот файл: `файл → за что отвечает` и `ключи/эндпойнты`.
- Периодически (или перед релизом) прогоняем авто-сканер и обновляем отчёт.
