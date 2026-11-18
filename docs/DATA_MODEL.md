# Data model

One MongoDB database: `what_dish_to_cook_today` (override with `MONGODB_URI`).
Schemas live in `server/config/database/connection.js`; the C# tools write the same collections
directly, so a field added on one side must be added on the other.

## Collections

### `role`

| Field | Type | Notes |
|---|---|---|
| `name` | String, unique | `user`, `admin` |
| `description` | String | |

Created on demand at signup if missing, and on boot by `promoteAdmin()`. `admin` reaches
`/api/admin/*` and the `/admin` screens; `user` is the signup default. The last enabled admin
cannot be demoted or disabled, and an admin cannot demote or disable themselves.

### `user`

| Field | Type | Notes |
|---|---|---|
| `username` | String, unique, required | |
| `password` | String, required | bcrypt hash |
| `email` | String, unique, required | |
| `roles` | [ObjectId → `role`], required | array; signup assigns the `user` role |
| `created_at` | Date | set at signup; null for older users, and `/api/auth/me` returns null |
| `profile_image` | Buffer | unused by the clients today |
| `is_disabled` | Boolean | set by an admin; a disabled account cannot sign in (401) or call an admin route |
| `must_change_password` | Boolean | set when an admin issues a temporary password; cleared by `POST /api/auth/password` |

### `ingredient`

| Field | Type | Notes |
|---|---|---|
| `name` | String, unique | letters and spaces only |
| `name_vi` | String | optional Vietnamese name; clients fall back to `name` |
| `best_post_id` | String | `_id` of the winning `ingredient_post` |
| `is_need_update` | Boolean | reserved for the vote job, never read today |

### `ingredient_post`

| Field | Type | Notes |
|---|---|---|
| `name` | String | ingredient name at post time |
| `user_id` | String | author id (from the token) |
| `ingredient_id` | String | parent `ingredient._id` as a string |
| `unique_id` | String, unique | `<ingredient_id>_<user_id>` — one post per user per ingredient |
| `is_best_post` | Boolean | only one true per ingredient |
| `date_time` | Date | rewritten on every edit |
| `points` | Number | votes |
| `type` | String | `Food`, `Spice`, `Fruit`, ... |
| `short_detail` | String | |
| `short_detail_vi` | String | optional Vietnamese description |
| `profile_image` | String | relative path under `server/` |
| `display_blocks` | Array | rendered content, see below |

### `dish`

| Field | Type | Notes |
|---|---|---|
| `name` | String, unique | letters and spaces only |
| `name_vi` | String | optional Vietnamese name |
| `best_post_id` | String | `_id` of the winning `dish_post` |
| `is_need_update` | Boolean | reserved, never read today |

### `dish_post`

| Field | Type | Notes |
|---|---|---|
| `name` | String | dish name at post time |
| `user_id` | String | author id (from the token) |
| `dish_id` | String | parent `dish._id` as a string |
| `unique_id` | String, unique | `<dish_id>_<user_id>` |
| `is_best_post` | Boolean | only one true per dish |
| `date_time` | Date | rewritten on every edit |
| `points` | Number | votes; editing a post no longer resets it |
| `views` | Number | incremented by `GET /get_dish_post/:id` |
| `comments` | Number | visible counter kept in step with the `comment` collection |
| `ingredients` | Array of String | ingredient ids |
| `short_detail` | String | |
| `short_detail_vi` | String | optional Vietnamese description |
| `profile_image` | String | relative path under `server/` |
| `images` | Array of String | extra photos, relative paths under `server/` |
| `servings` | Number | written by the catalog seed |
| `nutrition` | Object | per portion: `calories`, `protein`, `fat`, `carbs`, `fiber`, `sodium` |
| `ingredient_amounts` | Array | `{ingredient_id, grams}` for each catalog ingredient |
| `display_blocks` | Array | rendered content, see below |

### `comment`

| Field | Type | Notes |
|---|---|---|
| `dish_post_id` | String | parent `dish_post._id` |
| `user_id` | String | author id from the token |
| `body` | String | 1–1000 characters, stored as plain text; clients must render it as text, never HTML |
| `date_time` | Date | creation time |

Listing joins `user.username`; deleting keeps `dish_post.comments` in step. Comments exist only for dish posts.

### `vote`

| Field | Type | Notes |
|---|---|---|
| `user_id` | String | voter id |
| `dish_post_id` | String | parent `dish_post._id` |
| `date_time` | Date | when the vote was cast |

Unique compound index on `{user_id, dish_post_id}`. The toggle route inserts or deletes the row and updates
`dish_post.points` (increment on vote, floored decrement on unvote), so `points` stays the stored counter that
`get_best_dish_post` and the C# vote job rank by.

### `audit_log`

Append-only: no route updates or deletes a row.

| Field | Type | Notes |
|---|---|---|
| `actor_id` | ObjectId → `user` | the admin who acted |
| `actor_name` | String | username or email at the time of the action |
| `action` | String | `admin.signin`, `job.backup`, `job.reset`, `job.restore`, `job.recalc_best_post`, `backup.download`, `user.role`, `user.disabled`, `user.password`, ... |
| `target_type` | String | `user`, `ingredient`, `backup`, `job`, ... |
| `target_id` | String | id of the target, empty when there is none |
| `result` | String | `ok` or `failed` |
| `detail` | String | one line of context, never password material |
| `ip` | String | request ip |
| `created_at` | Date | |

Indexes on `created_at` and `action`; `/api/admin/audit` reads newest first.

### `admin_job`

The admin job queue. One row per operation, run in-process, one at a time.

| Field | Type | Notes |
|---|---|---|
| `type` | String | `backup`, `reset`, `restore`, `recalc_best_post`; `ai` is reserved and has no handler yet |
| `status` | String | `queued`, `running`, `done`, `failed` |
| `actor_id` | ObjectId → `user` | who queued it |
| `actor_name` | String | |
| `payload` | Object | `{ingredient_id}` for `recalc_best_post`, `{id}` (backup id) for `restore`, `{}` otherwise |
| `detail` | String | success line, e.g. `reset complete, backup backup-20261118-193000.json.gz` |
| `error` | String | failure message |
| `created_at`, `started_at`, `finished_at` | Date | |
| `provider`, `model`, `latency_ms`, `tokens_in`, `tokens_out`, `cost_estimate` | String / Number | reserved for the `ai` type; metrics only, never prompt or response text |

A `queued` or `running` row found at boot becomes `failed` with `detail: "server restarted"`;
nothing auto-retries. Index on `{status, created_at}`.

### `settings`

One row per key. The only key in use is `maintenance`.

| Field | Type | Notes |
|---|---|---|
| `key` | String, unique | `maintenance` |
| `enabled` | Boolean | while true, public `/api/*` answers 503 |
| `reason` | String | `catalog reset`, `catalog restore`, `server restarted` |
| `actor_id` | ObjectId → `user` | who switched it on |
| `actor_name` | String | |
| `owner_job_id` | ObjectId → `admin_job` | the job that owns the flag; only it may clear it |
| `updated_at` | Date | |

## Display blocks

`display_blocks` is an array of objects. Text blocks:

```json
{ "type": "text", "text": "...", "text_vi": "...", "font_size": 14, "font_weight": "bold",
  "text_align": "left", "color": "black" }
```

`text_vi` is optional; clients fall back to `text` when it is empty or missing.

Image blocks:

```json
{ "type": "image", "src": "public/pictures/dishs/Spaghetti.jpg", "text": "Caption",
  "font_size": 14, "size": "80%" }
```

`color` is a CSS colour name (`black`, `white`, ...). Templates for new blocks come from
`server/config/template/`.

## Invariants to keep

- `dish.best_post_id` and `dish_post.is_best_post` change together. The setter clears the old
  best post first, then writes both. Same for ingredients.
- A post's `unique_id` must stay `<parent id>_<user id>`; the create routes rely on the unique
  index to turn a second create into an update.
- `user_id`/`dish_id`/`ingredient_id` that become part of a folder path must be 24-character
  Mongo ids; the routes reject anything else before touching the filesystem.
- Uploaded files live under `server/public/gallery/`; only files starting with
  `public/gallery/temporary/` are moved, and only inside the repository.

## Seeding

All three paths read the canonical `catalog/*.json` and produce 38 ingredients and 13 dishes,
with `name_vi`, nutrition, servings, grams per ingredient and the image paths from
`catalog/images.json`:

- `db_control init --yes` — drops and re-seeds the six catalog collections from the terminal.
- `POST /api/admin/reset` — the same work as an admin job; it writes a backup first.
- `database_control_center` — the same reset from the offline Windows console.

Every seeded post is owned by the acting admin, so a reset needs an `admin_job` actor id and
fails before dropping anything when there is none. Unique indexes are recreated after the drop,
because dropping a collection drops its indexes with it.

## Backups

The backup contract is gzip JSON, `{format:"wdtct-backup", version:1, created_at, collections}`
with ObjectIds as 24-char hex strings and dates as ISO 8601. It exports the six catalog
collections plus `user`; a restore reads only the six and leaves `user`, `role`, `audit_log`,
`admin_job` and `settings` untouched. The server writes to `BACKUP_DIR` (default
`server/backups`, `/app/backups` in Compose); `db_control` writes wherever `--out` points. Keep
the newest 10 server archives; older ones are pruned automatically.
