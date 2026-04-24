# Database Manager

The Database Manager is an admin-only operations screen for the database that the current VonCMS install is already using.

It is not a database switcher, database creator, or phpMyAdmin replacement for arbitrary server-level dumps.

## The mental model

- The active database comes from `public/von_config.php`.
- Backup exports SQL from that active database.
- Import runs the uploaded SQL against that active database.
- Repair Database checks and repairs VonCMS schema gaps in that active database.

The import tool does not choose a target database from the uploaded file name, the old server name, or the old database name. If the current install is connected to `voncms_test`, the uploaded SQL runs against `voncms_test`.

## Backup

Use Backup when you want a SQL copy of the current VonCMS database tables.

The backup file includes table structure and table rows for the current database. It is designed for VonCMS round-trip restore through the same Database Manager.

Backup filenames use a sanitized label from the configured site name when available, for example `backup_my-news-site_2026-04-23_142000.sql`. If the site name is unavailable, VonCMS falls back to the current host or `voncms`.

The SQL backup does not include physical files such as uploaded images. If you are cloning or moving a full site, copy the uploads folder separately.

## Import

Use Import when you want to restore a VonCMS SQL backup into the current install's configured database.

Expected flow:

1. Confirm which database this install uses in `public/von_config.php`.
2. Take a fresh backup of the current database if it has data you might need.
3. Open `Admin > Database Manager`.
4. Choose the `.sql` file exported by VonCMS Backup.
5. Run Import.
6. Check the admin dashboard and public site after import.

Import is destructive when the SQL backup contains `DROP TABLE IF EXISTS`. A normal VonCMS backup uses that pattern so the restore can recreate tables cleanly. This means importing into the wrong database can overwrite that site's current data.

If the uploaded SQL contains `DROP` or `CREATE` statements, VonCMS asks for explicit confirmation before running it. After confirmation, the backend creates a server-side pre-import safety backup in the protected `public/data/backups/` folder before it starts the destructive restore.

That safety backup is a fallback for admin mistakes, not a replacement for checking the target database first. Do not import untrusted SQL. `CREATE DATABASE` and `CREATE SCHEMA` are blocked because this tool restores into the database already configured for the current install.

## Import error guide

Import errors are shown from the backend. Use the message to decide whether the file is wrong, the target database is wrong, or the import only partially ran.

| Error shown in admin                                                    | What it usually means                                                                                                                                                                      | What to do                                                                                                                                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `This SQL contains DROP/CREATE statements...`                           | The upload looks like a destructive restore. VonCMS has paused before running it.                                                                                                          | Continue only if the current install points to the database you intend to overwrite. VonCMS will create a server-side pre-import safety backup before continuing.                                                       |
| `CREATE DATABASE and CREATE SCHEMA are not supported...`                | The SQL is a server-level dump that tries to create or switch database scope. Database Manager restores into the already configured VonCMS database only.                                  | Create/select the target database in Laragon/phpMyAdmin first, connect VonCMS to it, then import a VonCMS table backup. Use phpMyAdmin/MySQL CLI for full server-level dumps.                                           |
| `There is no active transaction`                                        | On older builds, MySQL/MariaDB auto-committed a `DROP` or `CREATE` statement, then a later statement failed and masked the original SQL error. The database may now be partially restored. | Update to the current build if possible. Do not keep retrying on a live database. Check that the SQL file is a VonCMS backup, restore into a fresh/empty database if possible, then run `Repair Database` after import. |
| `Only INSERT, CREATE, SET, and DROP statements are allowed in imports.` | The uploaded SQL contains statements outside the VonCMS restore allowlist. Common examples are `USE`, `CREATE DATABASE`, `ALTER`, `UPDATE`, `DELETE`, or `TRUNCATE`.                       | Use a SQL file exported by VonCMS Backup. For full phpMyAdmin/server dumps, import through phpMyAdmin or the MySQL command line instead.                                                                                |
| `Database not configured`                                               | This VonCMS install is not connected to a database yet, or `public/von_config.php` is missing/unreadable.                                                                                  | Finish installation or confirm `public/von_config.php` points to the intended database.                                                                                                                                 |
| `No SQL file uploaded`                                                  | The browser did not send a file, or the upload failed before VonCMS received it.                                                                                                           | Choose the `.sql` file again and retry. Check PHP upload limits if the file is large.                                                                                                                                   |
| `Only .sql files allowed`                                               | The selected file extension is not `.sql`.                                                                                                                                                 | Export or rename the backup as a `.sql` file. Do not upload ZIP files directly here.                                                                                                                                    |
| `File too large (max 50MB)`                                             | The SQL file is larger than the Database Manager import limit.                                                                                                                             | Import through phpMyAdmin/MySQL CLI, or split the SQL file carefully.                                                                                                                                                   |
| `Empty SQL file`                                                        | The uploaded file has no SQL content, or the file read failed.                                                                                                                             | Re-export the backup and confirm the file is not 0 bytes.                                                                                                                                                               |
| `Network error`                                                         | The admin UI could not complete the request or parse a response from the server.                                                                                                           | Check the browser network tab and server/PHP error log. Large imports may hit hosting timeouts.                                                                                                                         |

If an import fails after some tables were dropped or created, treat the target database as uncertain until you restore a known-good backup or repeat the import into a clean database.

## Restoring into a different database

To restore a backup into another database, connect VonCMS to that database first.

Example local workflow with Laragon:

1. Create a new database in Laragon/phpMyAdmin, for example `voncms_test`.
2. Install VonCMS fresh using `voncms_test`, or update `public/von_config.php` so this install points to `voncms_test`.
3. Sign in to the admin panel for that install.
4. Open `Admin > Database Manager`.
5. Import the VonCMS `.sql` backup.

The old database name does not need to match the new database name. The restore target is the database configured for the current install.

## What not to import

Avoid importing random full phpMyAdmin or hosting-panel dumps through this tool if they contain server-level commands such as:

- `CREATE DATABASE`
- `USE database_name`
- `ALTER`
- `UPDATE`
- `DELETE`
- `TRUNCATE`

The importer is intentionally limited to the statement types needed for VonCMS backup restore. Use phpMyAdmin or the MySQL command line for server-level database moves that require database creation, database switching, or custom SQL.

## Query and Repair

Query is for read-only inspection of the active database. It is not meant for destructive SQL changes.

Repair Database is for VonCMS schema alignment, such as adding missing columns or tables expected by the current release. It does not repair low-level MySQL corruption.
