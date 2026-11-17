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

Created on demand at signup if missing (the seed tools do not create roles).

### `user`

| Field | Type | Notes |
|---|---|---|
| `username` | String, unique, required | |
| `password` | String, required | bcrypt hash |
| `email` | String, unique, required | |
| `roles` | [ObjectId → `role`], required | array; signup assigns the `user` role |
| `created_at` | Date | set at signup; null for older users, and `/api/auth/me` returns null |
| `profile_image` | Buffer | unused by the clients today |

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
| `comments` | Number | a counter only; there is no comment collection |
| `ingredients` | Array of String | ingredient ids |
| `short_detail` | String | |
| `short_detail_vi` | String | optional Vietnamese description |
| `profile_image` | String | relative path under `server/` |
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

### `database_worker_job`
| Field | Type | Notes |
|---|---|---|
| `data` | String | `ResetData` or `VoteBestPostIngredient:<ingredientId>` |
| `time_request` | String | ISO time, used by the vote job to skip stale work |

The worker deletes a job after success and keeps it after failure. Multiple jobs run in insertion
order, one batch per second.

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

- `db_control --init_data` — drops and re-seeds `ingredient`, `ingredient_post`, `dish`,
  `dish_post` with 9 ingredients and one dish. Requires user `moonshine@gmail.com`.
- `database_control_center` job `ResetData` — the same idea, but 6 ingredients and one dish,
  triggered from the app or by a queued job. The two seeds already differ; unify them if you
  touch either.
