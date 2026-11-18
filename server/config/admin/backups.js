const fs = require('fs/promises');
const path = require('path');
const zlib = require('zlib');
const { mongoose } = require('../database/connection');

const FORMAT = 'wdtct-backup';
const VERSION = 1;

//The six collections a reset rebuilds and a restore may replace.
const CATALOG_COLLECTIONS = ['ingredient', 'ingredient_post', 'dish', 'dish_post', 'vote', 'comment'];
//user is exported for disaster recovery only; restore ignores it.
const EXPORT_COLLECTIONS = CATALOG_COLLECTIONS.concat('user');
const FILE_PATTERN = /^backup-\d{8}-\d{6}(-\d+)?\.json\.gz$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

//Read per call so a test or a deployment can point BACKUP_DIR elsewhere.
const backupDir = function() {
    return process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups');
};

//BSON -> plain JSON: ObjectId becomes its hex string, Date an ISO string.
const toExportValue = function(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (value instanceof mongoose.Types.ObjectId) {
        return value.toString();
    }
    //Only User.profile_image is binary; a base64 string keeps the archive plain JSON.
    if (Buffer.isBuffer(value)) {
        return value.toString('base64');
    }
    if (Array.isArray(value)) {
        return value.map(toExportValue);
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [key, inner] of Object.entries(value)) {
            out[key] = toExportValue(inner);
        }
        return out;
    }
    return value;
};

const toExportDoc = function(doc) {
    return toExportValue(doc);
};

//Plain JSON -> BSON. Only `_id` becomes an ObjectId: fields like best_post_id hold hex strings by design.
const fromExportValue = function(value) {
    if (typeof value === 'string' && ISO_DATE.test(value)) {
        return new Date(value);
    }
    if (Array.isArray(value)) {
        return value.map(fromExportValue);
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [key, inner] of Object.entries(value)) {
            out[key] = key === '_id' && typeof inner === 'string'
                ? new mongoose.Types.ObjectId(inner)
                : fromExportValue(inner);
        }
        return out;
    }
    return value;
};

const fromExportDoc = function(doc) {
    return fromExportValue(doc);
};

const idOf = function(file) {
    return file.replace(/\.json\.gz$/, '');
};

//backup-YYYYMMDD-HHmmss, UTC.
const stampOf = function(date) {
    return date.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
};

//Two backups in one second must not overwrite each other.
const uniqueFile = async function(dir, createdAt) {
    const base = `backup-${stampOf(createdAt)}`;
    let file = `${base}.json.gz`;
    for (let counter = 1;; counter += 1) {
        try {
            await fs.access(path.join(dir, file));
        } catch (error) {
            return file;
        }
        file = `${base}-${counter}.json.gz`;
    }
};

const listBackups = async function() {
    const dir = backupDir();
    let names;
    try {
        names = await fs.readdir(dir);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
    const rows = [];
    for (const name of names) {
        if (!FILE_PATTERN.test(name)) {
            continue;
        }
        const stat = await fs.stat(path.join(dir, name));
        rows.push({
            id: idOf(name),
            file: name,
            name,
            bytes: stat.size,
            created_at: stat.mtime.toISOString()
        });
    }
    //Newest first; the timestamp is in the file name.
    rows.sort((left, right) => right.file.localeCompare(left.file));
    return rows;
};

const pruneBackups = async function(keep = 10) {
    const rows = await listBackups();
    const doomed = rows.slice(keep);
    for (const row of doomed) {
        await fs.unlink(path.join(backupDir(), row.file)).catch((error) => {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        });
    }
    return doomed.length;
};

//Writes gzip JSON. Only the listed collections, never audit_log, admin_job or settings.
const createBackup = async function() {
    const db = mongoose.connection.db;
    const collectionsOut = {};
    for (const name of EXPORT_COLLECTIONS) {
        const docs = await db.collection(name).find({}).toArray();
        collectionsOut[name] = docs.map(toExportDoc);
    }

    const created = new Date();
    const payload = {
        format: FORMAT,
        version: VERSION,
        created_at: created.toISOString(),
        collections: collectionsOut
    };
    const body = zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
    const dir = backupDir();
    await fs.mkdir(dir, { recursive: true });
    const file = await uniqueFile(dir, created);
    await fs.writeFile(path.join(dir, file), body);
    await pruneBackups(10);

    return { id: idOf(file), file, bytes: body.length, created_at: payload.created_at };
};

//The id is resolved against the known listing, so no path ever comes from input.
const readBackup = async function(id) {
    const rows = await listBackups();
    const row = rows.find(candidate => candidate.id === id);
    if (!row) {
        throw new Error(`Backup ${id} not found`);
    }
    const raw = await fs.readFile(path.join(backupDir(), row.file));
    return JSON.parse(zlib.gunzipSync(raw).toString('utf8'));
};

module.exports = {
    FORMAT,
    VERSION,
    CATALOG_COLLECTIONS,
    EXPORT_COLLECTIONS,
    toExportDoc,
    fromExportDoc,
    backupDir,
    createBackup,
    listBackups,
    pruneBackups,
    readBackup
};
