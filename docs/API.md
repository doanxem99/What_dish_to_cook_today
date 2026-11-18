# API reference

Base URL: `http://localhost:3000`. All responses are JSON unless stated.
Most routes answer HTTP 200 and describe the outcome in the body
(`{status: N}` or `{isSuccess: bool}`), so check the body, not only the status code.

`(auth)` means the route runs `verifyToken`: the `token` cookie must be present and valid,
and the server overwrites the user id from the token.

## Auth — `/api/auth`

| Method | Path | Body | Answer |
|---|---|---|---|
| POST | `/signin` | `{username, password}` (username may be the email) | `{message, user:{username}}` and the `token` cookie |
| POST | `/signup` | `{username, email, password}` | `{message}`; 400 when a name/email is taken, 500 on other errors |
| POST | `/verifytoken` | – (cookie) | `{message, userid, roles}`; 401 when the cookie is missing or bad |
| GET | `/me` | – (cookie) | `{message, user:{id, username, email, created_at, roles}}`; `created_at` is null for users created before the field existed |
| POST | `/signout` | – | `{message}` and clears the cookie |

## Dishes — `/api/dish`

### Search — `/api/dish/search`

| Method | Path | Answer |
|---|---|---|
| GET | `/` | `[{id, name, short_detail}]` |
| GET | `/keyword` | same (empty keyword) |
| GET | `/keyword/:keyword` | same, regex match on the name, max 10, only dishes with a best post |

### Selection — `/api/dish/selection`

| Method | Path | Answer |
|---|---|---|
| GET | `/` | `{isSuccess, data:[{id, name, short_detail, profile_image}]}` |
| GET | `/ingredients/` | same |
| GET | `/ingredients/:ids` | same, `ids` = Mongo ids joined with `-` |
| GET | `/homemade` | `{isSuccess, data:[preview]}` — best posts whose author is neither the seed admin nor `unknow` |

### Profile — `/api/dish/profile`

| Method | Path | Body | Answer |
|---|---|---|---|
| POST | `/create_dish` (auth) | `{name, ingredients:[], short_detail, profile_image, display_blocks:[]}` | `{status, dish_id, detail}` |
| POST | `/create_dish_post` (auth) | `{dish_id, data:{name, ingredients:[], short_detail, profile_image, display_blocks:[]}}` | `{status, detail, dish_post_id}` |
| GET | `/get_dish/:dish_id` | – | `{status, data:{_id, name, best_post_id}}` |
| GET | `/get_dish_post/:dish_post_id` | – | `{status, data:{...post}}`, also increments `views` |
| GET | `/get_best_dish_post` | – | `{status, data:{...post, username, ingredients:[{ingredient_id,name}]}}` |
| GET | `/mine` (auth) | – | `{status, status_code, data:[{id, name, name_vi, short_detail, profile_image, is_best_post, date_time}]}`, newest first, max 50 |
| GET | `/comments/:dish_post_id` | – (optional cookie marks `is_mine`) | `{status, status_code, data:[{id, body, user_id, username, date_time, is_mine}]}`, newest first, max 50 |
| POST | `/comment/:dish_post_id` (auth) | `{body}` (1–1000 characters after trim) | `{status, status_code, data:{...comment}}`; 400 for empty/too long, 404 for an unknown post |
| DELETE | `/comment/:comment_id` (auth) | – | `{status, status_code, data:{deleted:true}}`; 403 for a non-owner, 404 when already gone |
| POST | `/vote/:dish_post_id` (auth) | – | `{status, status_code, data:{voted, points}}`; repeats toggle the vote. 404 for an unknown post |

`status` uses `server/config/enum/profile_enum.js`: for creation `0` success, `1` bad name,
`2` already exists; for post create `0` created, `1` edited, `2` error.
`name` must match `/^[A-Za-z _]+$/` (letters and spaces only).

## Ingredients — `/api/ingredient`

### Search — `/api/ingredient/search`

| Method | Path | Answer |
|---|---|---|
| GET | `/` | `[{id, name}]` |
| GET | `/keyword/:keyword` | same, regex match, max 10, only ingredients with a best post |
| GET | `/ids/:ids` | same, `ids` joined with `-` |

### Selection — `/api/ingredient/selection`

| Method | Path | Answer |
|---|---|---|
| GET | `/` | `{isSuccess, data:[{id, name, type, short_detail, profile_image}]}` |

### Profile — `/api/ingredient/profile`

| Method | Path | Body | Answer |
|---|---|---|---|
| POST | `/create_ingredient` (auth) | `{name, type, short_detail, profile_image}` | `{status, status_code, ingredient_id, detail}` |
| POST | `/create_ingredient_post` (auth) | `{ingredient_id, ingredient_name, data:{type, short_detail, profile_image, display_blocks:[]}}` | `{status, status_code, detail, ingredient_post_id}` |
| GET | `/get_ingredient/:ingredient_id` | – | `{status, status_code, data:{_id, name, best_post_id}}` |
| GET | `/get_ingredient_post/:ingredient_post_id` | – | `{status, status_code, data:{...post}}` |
| GET | `/mine` (auth) | – | `{status, status_code, data:[{id, name, name_vi, type, short_detail, profile_image, is_best_post, date_time}]}`, newest first, max 50 |

Creating a post for a pair that already exists edits the existing post instead
(`unique_id = "<parent id>_<user id>"`). There is no separate update route.

## Templates — `/api/template`

| Method | Path | Answer |
|---|---|---|
| GET | `/ingredient` | ingredient editor template |
| GET | `/dish` | dish editor template |
| GET | `/image_block` | image block template |

## Upload — `/api/gallery_upload`

| Method | Path | Body | Answer |
|---|---|---|---|
| POST | `/temporary` (auth) | multipart, field name `file` | `{isSuccess, path}` with `path` relative to `server/`, e.g. `public/gallery/temporary/...` |

Allowed extensions: `png`, `jpg`, `jpeg`. Maximum size 5 MB. The file starts in the temporary
folder and is moved to its final folder by the profile create/update routes.

## Translation — `/api/translate`

| Method | Path | Body | Answer |
|---|---|---|---|
| POST | `/` | `{text, source: "en"\|"vi", target: "en"\|"vi"}` | `{text}` translated |

Proxies a LibreTranslate-compatible service set in `TRANSLATE_URL`. Without it the route answers
503 with a clear message and the editor keeps translation off. Text is limited to 2000 characters.

## Health — `/api/health`

| Method | Path | Answer |
|---|---|---|
| GET | `/` | `{status:"ok", uptime_s}` |

Public liveness only: no counts, no latency, no user data. The Docker and Compose healthchecks
read it, and it keeps answering while maintenance mode is on.

## Admin — `/api/admin`

Every route runs `requireAdmin`: a valid `token` cookie, an existing account, not disabled, and
the `admin` role. Authenticating failures answer 401 (`unauthorized`) and 403 (`forbidden`);
errors always use `{error: {code, message}}`. Success bodies are plain objects. No password
hash, token or AI prompt text is ever returned.

| Method | Path | Body / query | Answer |
|---|---|---|---|
| GET | `/health` | – | probes and counts, see below; 200 |
| GET | `/jobs` | `?type=&status=&page=` | `{rows, total, page}`, newest first, 25 per page |
| POST | `/jobs/recalc-best-post` | `{ingredient_id}` | job row, 202; 400 bad id, 404 unknown ingredient |
| POST | `/backup` | – | job row, 202 |
| GET | `/backups` | – | `{rows, total}` newest first |
| GET | `/backups/:id` | – | gzip archive download with its filename; 404 unknown id |
| POST | `/restore` | `{backup_id, confirm:"RESTORE"}` | job row, 202; 400 wrong confirm, 404 unknown id, 409 a job is running |
| POST | `/reset` | `{confirm:"RESET"}` | job row, 202; 400 wrong confirm, 409 a job is running |
| GET | `/users` | `?q=&page=` | `{rows, total, page}`; rows hold `id, username, email, created_at, is_disabled, must_change_password, roles`, never the password hash |
| POST | `/users/:id/role` | `{admin: true\|false}` | user row, 200; 400 not a boolean, 404 unknown user, 409 self-demote or last admin |
| POST | `/users/:id/disabled` | `{disabled: true\|false}` | user row, 200; 400 not a boolean, 404 unknown user, 409 self-disable or last admin |
| POST | `/users/:id/password` | – | `{password, user}`, 200; the temporary password is shown once and `must_change_password` is set |
| GET | `/audit` | `?action=&actor=&page=` | `{rows, total, page}`, newest first, 25 per page |

`/health` answers:

- `version`, `uptime_s`.
- `database`: `{ok, latency_ms}` from a ping.
- `counts`: `{users, ingredients, dishes, dish_posts, comments, votes}`.
- `translation`: `{ok, configured, languages}` or `{ok:false, configured, error}`. The base URL is
  derived from `TRANSLATE_URL` by stripping `/translate`; `configured` is false when the variable is
  unset, so the page names the right fix. The probe caches for 30 s and never runs on the 15 s page
  poll.
- `ai`: `{configured}`, from `AI_ENABLED` only.
- `backup`: `{dir_writable, dir, last, error}`.
- `maintenance`: `{on, reason, job_id, updated_at}`. `reason` is the server's sentence (`catalog
  reset` or `catalog restore`) and `job_id` is the job that owns the flag.
- `last_reset`: the newest reset job summary or `null`.

Every mutation writes an `audit_log` row with the acting admin from `req.current_user`.
Reset and restore run in the job queue and write a backup first; while one runs, the public API
answers 503 and `/api/health`, `/api/auth/*` and `/api/admin/*` keep working.

## Web pages

| Method | Path | Answer |
|---|---|---|
| GET | `/` | Vue build (`server/web_ui/index.html`) with SPA fallback |
| GET | `/flutter` | Flutter build (`server/web/index.html`) and its assets |
| GET | `/web`, `/web/*` | 301 redirect to `/flutter/` |
| GET | `/web` | same |
| GET | `/web/:page` | redirect to `/` |
| GET | `/public/*` | uploaded images |

The `/worker` WebSocket endpoint was removed: admin operations run in-process through the job
queue, and the desktop tools are an offline repair kit.

