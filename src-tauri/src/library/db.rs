//! SQLite persistence for the local music library.

use std::path::Path;

use rusqlite::{params, types::Type, Connection, OptionalExtension};

use crate::types::{Album, Track};

/// SQLite database wrapper for the music library.
pub struct Database {
    connection: Connection,
}

impl Database {
    /// Opens a database and applies the current schema.
    pub fn open(path: &Path) -> Result<Self, rusqlite::Error> {
        let connection = Connection::open(path)?;
        let database = Self { connection };
        database.migrate()?;
        Ok(database)
    }

    /// Opens an in-memory database for tests.
    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self, rusqlite::Error> {
        let connection = Connection::open_in_memory()?;
        let database = Self { connection };
        database.migrate()?;
        Ok(database)
    }

    fn migrate(&self) -> Result<(), rusqlite::Error> {
        self.connection.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS tracks (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                title TEXT,
                artist TEXT,
                album TEXT,
                album_artist TEXT,
                track_number INTEGER,
                disc_number INTEGER,
                year INTEGER,
                genre TEXT,
                duration_ms INTEGER NOT NULL DEFAULT 0,
                sample_rate INTEGER NOT NULL DEFAULT 0,
                bit_depth INTEGER,
                bitrate INTEGER,
                file_size INTEGER NOT NULL DEFAULT 0,
                has_cover INTEGER NOT NULL DEFAULT 0,
                cover_cache_path TEXT,
                date_added INTEGER NOT NULL,
                date_modified INTEGER NOT NULL DEFAULT 0,
                play_count INTEGER NOT NULL DEFAULT 0,
                last_played INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
            CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
            CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
            CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
                title, artist, album, content='tracks', content_rowid='rowid'
            );
            CREATE TRIGGER IF NOT EXISTS tracks_ai AFTER INSERT ON tracks BEGIN
                INSERT INTO tracks_fts(rowid, title, artist, album)
                VALUES (new.rowid, new.title, new.artist, new.album);
            END;
            CREATE TRIGGER IF NOT EXISTS tracks_ad AFTER DELETE ON tracks BEGIN
                INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album)
                VALUES ('delete', old.rowid, old.title, old.artist, old.album);
            END;
            CREATE TRIGGER IF NOT EXISTS tracks_au AFTER UPDATE ON tracks BEGIN
                INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album)
                VALUES ('delete', old.rowid, old.title, old.artist, old.album);
                INSERT INTO tracks_fts(rowid, title, artist, album)
                VALUES (new.rowid, new.title, new.artist, new.album);
            END;
            "#,
        )?;
        self.ensure_column(
            "tracks",
            "date_modified",
            "ALTER TABLE tracks ADD COLUMN date_modified INTEGER NOT NULL DEFAULT 0",
        )?;
        self.ensure_column(
            "tracks",
            "play_count",
            "ALTER TABLE tracks ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0",
        )?;
        self.ensure_column(
            "tracks",
            "last_played",
            "ALTER TABLE tracks ADD COLUMN last_played INTEGER",
        )?;
        self.connection
            .execute("INSERT INTO tracks_fts(tracks_fts) VALUES ('rebuild')", [])?;
        Ok(())
    }

    fn ensure_column(
        &self,
        table: &str,
        column: &str,
        statement: &str,
    ) -> Result<(), rusqlite::Error> {
        let mut columns = self
            .connection
            .prepare(&format!("PRAGMA table_info({table})"))?;
        let exists = columns
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<Vec<_>, _>>()?
            .iter()
            .any(|name| name == column);
        if !exists {
            self.connection.execute(statement, [])?;
        }
        Ok(())
    }

    /// Inserts or updates a track by stable id/path.
    pub fn upsert_track(&self, track: &Track) -> Result<(), rusqlite::Error> {
        self.connection.execute(
            r#"
            INSERT INTO tracks (
                id, path, title, artist, album, album_artist, track_number, disc_number,
                year, genre, duration_ms, sample_rate, bit_depth, bitrate, file_size,
                has_cover, cover_cache_path, date_added, date_modified, play_count, last_played
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21
            )
            ON CONFLICT(path) DO UPDATE SET
                title = excluded.title,
                artist = excluded.artist,
                album = excluded.album,
                album_artist = excluded.album_artist,
                track_number = excluded.track_number,
                disc_number = excluded.disc_number,
                year = excluded.year,
                genre = excluded.genre,
                duration_ms = excluded.duration_ms,
                sample_rate = excluded.sample_rate,
                bit_depth = excluded.bit_depth,
                bitrate = excluded.bitrate,
                file_size = excluded.file_size,
                has_cover = excluded.has_cover,
                cover_cache_path = excluded.cover_cache_path,
                date_modified = excluded.date_modified
            "#,
            params![
                track.id,
                track.path,
                track.title,
                track.artist,
                track.album,
                track.album_artist,
                track.track_number,
                track.disc_number,
                track.year,
                track.genre,
                track.duration_ms,
                track.sample_rate,
                track.bit_depth,
                track.bitrate,
                track.file_size,
                track.has_cover,
                track.cover_cache_path,
                track.date_added,
                track.date_modified,
                track.play_count,
                track.last_played,
            ],
        )?;
        Ok(())
    }

    /// Returns all tracks ordered by title/path.
    pub fn all_tracks(&self) -> Result<Vec<Track>, rusqlite::Error> {
        let mut statement = self.connection.prepare(
            r#"
            SELECT id, path, title, artist, album, album_artist, track_number, disc_number,
                   year, genre, duration_ms, sample_rate, bit_depth, bitrate, file_size,
                   has_cover, cover_cache_path, date_added, date_modified, play_count, last_played
            FROM tracks
            ORDER BY COALESCE(title, path) COLLATE NOCASE
            "#,
        )?;
        let rows = statement.query_map([], row_to_track)?;
        rows.collect()
    }

    /// Searches tracks by title, artist, album, genre, or path.
    pub fn search_tracks(&self, query: &str) -> Result<Vec<Track>, rusqlite::Error> {
        let like_query = format!("%{}%", query.trim());
        let mut statement = self.connection.prepare(
            r#"
            SELECT id, path, title, artist, album, album_artist, track_number, disc_number,
                   year, genre, duration_ms, sample_rate, bit_depth, bitrate, file_size,
                   has_cover, cover_cache_path, date_added, date_modified, play_count, last_played
            FROM tracks
            WHERE title LIKE ?1 OR artist LIKE ?1 OR album LIKE ?1 OR genre LIKE ?1 OR path LIKE ?1
            ORDER BY COALESCE(title, path) COLLATE NOCASE
            "#,
        )?;
        let rows = statement.query_map([like_query], row_to_track)?;
        rows.collect()
    }

    /// Returns one track by stable id.
    pub fn track_by_id(&self, id: &str) -> Result<Option<Track>, rusqlite::Error> {
        self.connection
            .query_row(
                r#"
                SELECT id, path, title, artist, album, album_artist, track_number, disc_number,
                       year, genre, duration_ms, sample_rate, bit_depth, bitrate, file_size,
                       has_cover, cover_cache_path, date_added, date_modified, play_count, last_played
                FROM tracks
                WHERE id = ?1
                "#,
                [id],
                row_to_track,
            )
            .optional()
    }

    /// Returns whether a canonical path already exists in the library.
    pub fn track_exists_by_path(&self, path: &str) -> Result<bool, rusqlite::Error> {
        self.connection
            .query_row(
                "SELECT 1 FROM tracks WHERE path = ?1 LIMIT 1",
                [path],
                |_| Ok(()),
            )
            .optional()
            .map(|value| value.is_some())
    }

    /// Records that a track started playback.
    pub fn record_playback_by_path(
        &self,
        path: &str,
        played_at: i64,
    ) -> Result<bool, rusqlite::Error> {
        self.connection
            .execute(
                r#"
                UPDATE tracks
                SET play_count = play_count + 1,
                    last_played = ?2
                WHERE path = ?1
                "#,
                params![path, played_at],
            )
            .map(|updated| updated > 0)
    }

    /// Returns all track paths currently stored in the library.
    pub fn track_paths(&self) -> Result<Vec<String>, rusqlite::Error> {
        let mut statement = self.connection.prepare("SELECT path FROM tracks")?;
        let rows = statement.query_map([], |row| row.get(0))?;
        rows.collect()
    }

    /// Removes one track by source path.
    pub fn remove_track_by_path(&self, path: &str) -> Result<bool, rusqlite::Error> {
        self.connection
            .execute("DELETE FROM tracks WHERE path = ?1", [path])
            .map(|removed| removed > 0)
    }

    /// Removes all tracks stored under a library directory.
    pub fn remove_tracks_under_directory(&self, root: &Path) -> Result<u32, rusqlite::Error> {
        let mut removed = 0_u32;
        for stored_path in self.track_paths()? {
            if Path::new(&stored_path).starts_with(root)
                && self.remove_track_by_path(&stored_path)?
            {
                removed = removed.saturating_add(1);
            }
        }
        Ok(removed)
    }

    /// Groups tracks into album summaries.
    pub fn all_albums(&self) -> Result<Vec<Album>, rusqlite::Error> {
        let tracks = self.all_tracks()?;
        let mut albums = Vec::<Album>::new();
        for track in tracks {
            let name = track
                .album
                .clone()
                .unwrap_or_else(|| "Unknown Album".to_string());
            if let Some(album) = albums.iter_mut().find(|album| album.name == name) {
                album.track_count += 1;
                album.tracks.push(track);
            } else {
                albums.push(Album {
                    name,
                    artist: track.album_artist.clone().or_else(|| track.artist.clone()),
                    year: track.year,
                    track_count: 1,
                    cover_cache_path: track.cover_cache_path.clone(),
                    tracks: vec![track],
                });
            }
        }
        Ok(albums)
    }
}

fn row_to_track(row: &rusqlite::Row<'_>) -> Result<Track, rusqlite::Error> {
    let duration_ms = integer_to_u64(row.get(10)?, 10)?;
    let sample_rate = integer_to_u32(row.get(11)?, 11)?;
    let bit_depth = optional_integer_to_u32(row.get(12)?, 12)?;
    let bitrate = optional_integer_to_u32(row.get(13)?, 13)?;
    let file_size = integer_to_u64(row.get(14)?, 14)?;
    let has_cover: i64 = row.get(15)?;
    let play_count = integer_to_u32(row.get(19)?, 19)?;

    Ok(Track {
        id: row.get(0)?,
        path: row.get(1)?,
        title: row.get(2)?,
        artist: row.get(3)?,
        album: row.get(4)?,
        album_artist: row.get(5)?,
        track_number: row.get(6)?,
        disc_number: row.get(7)?,
        year: row.get(8)?,
        genre: row.get(9)?,
        duration_ms,
        sample_rate,
        bit_depth,
        bitrate,
        file_size,
        has_cover: has_cover != 0,
        cover_cache_path: row.get(16)?,
        date_added: row.get(17)?,
        date_modified: row.get(18)?,
        play_count,
        last_played: row.get(20)?,
    })
}

fn integer_to_u64(value: i64, column: usize) -> Result<u64, rusqlite::Error> {
    u64::try_from(value).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(column, Type::Integer, Box::new(error))
    })
}

fn integer_to_u32(value: i64, column: usize) -> Result<u32, rusqlite::Error> {
    u32::try_from(value).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(column, Type::Integer, Box::new(error))
    })
}

fn optional_integer_to_u32(
    value: Option<i64>,
    column: usize,
) -> Result<Option<u32>, rusqlite::Error> {
    value.map(|inner| integer_to_u32(inner, column)).transpose()
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;
    use std::time::{SystemTime, UNIX_EPOCH};

    use rusqlite::Connection;

    use crate::library::metadata::track_id_for_path;
    use crate::types::Track;

    use super::Database;

    fn track(path: &str, title: &str) -> Track {
        Track {
            id: track_id_for_path(std::path::Path::new(path)),
            path: path.to_string(),
            title: Some(title.to_string()),
            artist: Some("Artist".to_string()),
            album: Some("Album".to_string()),
            album_artist: Some("Artist".to_string()),
            track_number: None,
            disc_number: None,
            year: Some(2026),
            genre: None,
            duration_ms: 0,
            sample_rate: 0,
            bit_depth: None,
            bitrate: None,
            file_size: 12,
            has_cover: false,
            cover_cache_path: None,
            date_added: 1,
            date_modified: 1,
            play_count: 0,
            last_played: None,
        }
    }

    fn temp_database_path() -> std::path::PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "melodist-db-test-{}-{suffix}.sqlite3",
            std::process::id()
        ))
    }

    #[test]
    fn upsert_is_idempotent_by_path() {
        let database = Database::open_in_memory().expect("database opens");
        database
            .upsert_track(&track("/tmp/song.flac", "First"))
            .expect("insert");
        database
            .upsert_track(&track("/tmp/song.flac", "Second"))
            .expect("update");

        let tracks = database.all_tracks().expect("tracks load");
        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].title.as_deref(), Some("Second"));
    }

    #[test]
    fn groups_tracks_into_albums() {
        let database = Database::open_in_memory().expect("database opens");
        database
            .upsert_track(&track("/tmp/a.flac", "A"))
            .expect("insert a");
        database
            .upsert_track(&track("/tmp/b.flac", "B"))
            .expect("insert b");

        let albums = database.all_albums().expect("albums load");
        assert_eq!(albums.len(), 1);
        assert_eq!(albums[0].track_count, 2);
    }

    #[test]
    fn finds_track_by_id() {
        let database = Database::open_in_memory().expect("database opens");
        let track = track("/tmp/found.flac", "Found");
        let id = track.id.clone();
        database.upsert_track(&track).expect("insert");

        let found = database.track_by_id(&id).expect("lookup");
        assert_eq!(
            found.and_then(|track| track.title),
            Some("Found".to_string())
        );
        assert!(database
            .track_by_id("missing")
            .expect("missing lookup")
            .is_none());
    }

    #[test]
    fn records_playback_count_and_last_played() {
        let database = Database::open_in_memory().expect("database opens");
        let track = track("/tmp/played.flac", "Played");
        let id = track.id.clone();
        database.upsert_track(&track).expect("insert");

        assert!(database
            .record_playback_by_path("/tmp/played.flac", 42)
            .expect("record playback"));
        let played = database
            .track_by_id(&id)
            .expect("track load")
            .expect("track exists");

        assert_eq!(played.play_count, 1);
        assert_eq!(played.last_played, Some(42));
    }

    #[test]
    fn checks_track_existence_by_path() {
        let database = Database::open_in_memory().expect("database opens");
        let track = track("/tmp/exists.flac", "Exists");
        database.upsert_track(&track).expect("insert");

        assert!(database
            .track_exists_by_path("/tmp/exists.flac")
            .expect("exists lookup"));
        assert!(!database
            .track_exists_by_path("/tmp/missing.flac")
            .expect("missing lookup"));
    }

    #[test]
    fn removes_track_by_path() {
        let database = Database::open_in_memory().expect("database opens");
        database
            .upsert_track(&track("/tmp/remove.flac", "Remove"))
            .expect("insert");

        assert_eq!(
            database.track_paths().expect("paths"),
            vec!["/tmp/remove.flac"]
        );
        assert!(database
            .remove_track_by_path("/tmp/remove.flac")
            .expect("remove"));
        assert!(!database
            .remove_track_by_path("/tmp/remove.flac")
            .expect("remove again"));
        assert!(database.all_tracks().expect("tracks").is_empty());
    }

    #[test]
    fn removes_tracks_under_directory_only() {
        let database = Database::open_in_memory().expect("database opens");
        database
            .upsert_track(&track("/tmp/library/a/song.flac", "Remove A"))
            .expect("insert a");
        database
            .upsert_track(&track("/tmp/library/b/song.flac", "Remove B"))
            .expect("insert b");
        database
            .upsert_track(&track("/tmp/other/song.flac", "Keep"))
            .expect("insert keep");

        let removed = database
            .remove_tracks_under_directory(Path::new("/tmp/library"))
            .expect("remove directory");
        let tracks = database.all_tracks().expect("tracks");

        assert_eq!(removed, 2);
        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].title.as_deref(), Some("Keep"));
    }

    #[test]
    fn migrates_existing_tracks_table_with_date_modified_and_fts() {
        let path = temp_database_path();
        {
            let connection = Connection::open(&path).expect("old database opens");
            connection
                .execute_batch(
                    r#"
                    CREATE TABLE tracks (
                        id TEXT PRIMARY KEY,
                        path TEXT NOT NULL UNIQUE,
                        title TEXT,
                        artist TEXT,
                        album TEXT,
                        album_artist TEXT,
                        track_number INTEGER,
                        disc_number INTEGER,
                        year INTEGER,
                        genre TEXT,
                        duration_ms INTEGER NOT NULL DEFAULT 0,
                        sample_rate INTEGER NOT NULL DEFAULT 0,
                        bit_depth INTEGER,
                        bitrate INTEGER,
                        file_size INTEGER NOT NULL DEFAULT 0,
                        has_cover INTEGER NOT NULL DEFAULT 0,
                        cover_cache_path TEXT,
                        date_added INTEGER NOT NULL
                    );
                    "#,
                )
                .expect("old schema created");
        }

        let database = Database::open(&path).expect("database migrates");
        let columns = database
            .connection
            .prepare("PRAGMA table_info(tracks)")
            .expect("table info prepares")
            .query_map([], |row| row.get::<_, String>(1))
            .expect("table info reads")
            .collect::<Result<Vec<_>, _>>()
            .expect("columns collect");
        let fts_tables: i64 = database
            .connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'tracks_fts'",
                [],
                |row| row.get(0),
            )
            .expect("fts table lookup");

        assert!(columns.iter().any(|column| column == "date_modified"));
        assert!(columns.iter().any(|column| column == "play_count"));
        assert!(columns.iter().any(|column| column == "last_played"));
        assert_eq!(fts_tables, 1);
        drop(database);
        fs::remove_file(path).expect("cleanup database");
    }
}
