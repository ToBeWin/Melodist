use thiserror::Error;

use crate::types::LrcLine;

/// Error returned when an LRC timestamp cannot be parsed.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum LrcParseError {
    /// A timestamp-like tag was malformed.
    #[error("invalid LRC timestamp on line {line}: {tag}")]
    InvalidTimestamp {
        /// One-based line number in the input.
        line: usize,
        /// Original timestamp tag content without brackets.
        tag: String,
    },
}

/// Parses LRC text into timestamped lyric lines.
///
/// Supports standard `[mm:ss.xx]` timestamps with 10ms precision and multiple
/// timestamps on a single lyric line. Metadata tags such as `[ar:...]` are
/// ignored.
pub fn parse_lrc(input: &str) -> Result<Vec<LrcLine>, LrcParseError> {
    let mut lines = Vec::new();

    for (index, raw_line) in input.lines().enumerate() {
        let line_number = index + 1;
        let mut remainder = raw_line.trim_start();
        let mut timestamps = Vec::new();

        while let Some(after_open) = remainder.strip_prefix('[') {
            let Some(close_index) = after_open.find(']') else {
                if is_timestamp_candidate(after_open) {
                    return Err(LrcParseError::InvalidTimestamp {
                        line: line_number,
                        tag: after_open.to_string(),
                    });
                }
                break;
            };

            let tag = &after_open[..close_index];
            if is_timestamp_candidate(tag) {
                let timestamp_ms =
                    parse_timestamp(tag).ok_or_else(|| LrcParseError::InvalidTimestamp {
                        line: line_number,
                        tag: tag.to_string(),
                    })?;
                timestamps.push(timestamp_ms);
            }

            remainder = &after_open[close_index + 1..];
        }

        if timestamps.is_empty() {
            continue;
        }

        let text = remainder.trim_start().to_string();
        for timestamp_ms in timestamps {
            lines.push(LrcLine {
                timestamp_ms,
                text: text.clone(),
                translated_text: None,
                word_timestamps: None,
            });
        }
    }

    lines.sort_by_key(|line| line.timestamp_ms);
    Ok(lines)
}

/// Serializes timestamped lyric lines to standard LRC text.
///
/// Timestamps are emitted as `[mm:ss.xx]` at 10ms precision. Translation and
/// word-level timestamp fields are intentionally not written by this basic LRC
/// writer.
pub fn write_lrc(lines: &[LrcLine]) -> String {
    let mut output = String::new();

    for line in lines {
        output.push_str(&format_timestamp(line.timestamp_ms));
        output.push_str(&line.text);
        output.push('\n');
    }

    output
}

fn is_timestamp_candidate(tag: &str) -> bool {
    tag.chars()
        .next()
        .is_some_and(|character| character.is_ascii_digit())
        && tag.contains(':')
}

fn parse_timestamp(tag: &str) -> Option<u64> {
    let (minutes, seconds_and_fraction) = tag.split_once(':')?;
    let (seconds, fraction) = seconds_and_fraction
        .split_once('.')
        .map_or((seconds_and_fraction, ""), |parts| parts);

    if minutes.is_empty()
        || seconds.len() != 2
        || !minutes.chars().all(|character| character.is_ascii_digit())
        || !seconds.chars().all(|character| character.is_ascii_digit())
        || fraction.len() > 3
        || !fraction.chars().all(|character| character.is_ascii_digit())
    {
        return None;
    }

    let minutes = minutes.parse::<u64>().ok()?;
    let seconds = seconds.parse::<u64>().ok()?;
    let fraction_ms = match fraction.len() {
        0 => 0,
        1 => fraction.parse::<u64>().ok()? * 100,
        2 => fraction.parse::<u64>().ok()? * 10,
        3 => fraction.parse::<u64>().ok()?,
        _ => return None,
    };

    if seconds >= 60 {
        return None;
    }

    Some((minutes * 60_000) + (seconds * 1_000) + fraction_ms)
}

fn format_timestamp(timestamp_ms: u64) -> String {
    let total_centiseconds = (timestamp_ms + 5) / 10;
    let minutes = total_centiseconds / 6_000;
    let seconds = (total_centiseconds % 6_000) / 100;
    let centiseconds = total_centiseconds % 100;

    format!("[{minutes:02}:{seconds:02}.{centiseconds:02}]")
}

#[cfg(test)]
mod tests {
    use super::{parse_lrc, write_lrc};

    use crate::types::LrcLine;

    #[test]
    fn parses_basic_lrc_lines() {
        let parsed = parse_lrc("[00:01.23]First line\n[02:03.40]Second line")
            .expect("basic LRC should parse");

        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].timestamp_ms, 1_230);
        assert_eq!(parsed[0].text, "First line");
        assert_eq!(parsed[1].timestamp_ms, 123_400);
        assert_eq!(parsed[1].text, "Second line");
    }

    #[test]
    fn parses_multiple_timestamps_on_one_line() {
        let parsed =
            parse_lrc("[00:10.00][00:20.50]Repeated chorus").expect("multi-tag LRC should parse");

        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].timestamp_ms, 10_000);
        assert_eq!(parsed[0].text, "Repeated chorus");
        assert_eq!(parsed[1].timestamp_ms, 20_500);
        assert_eq!(parsed[1].text, "Repeated chorus");
    }

    #[test]
    fn parses_common_timestamp_precisions() {
        let parsed = parse_lrc(
            "[00:01]No fraction\n[00:02.3]Tenths\n[00:03.45]Centiseconds\n[00:04.678]Milliseconds",
        )
        .expect("common timestamp precisions should parse");

        assert_eq!(parsed[0].timestamp_ms, 1_000);
        assert_eq!(parsed[1].timestamp_ms, 2_300);
        assert_eq!(parsed[2].timestamp_ms, 3_450);
        assert_eq!(parsed[3].timestamp_ms, 4_678);
    }

    #[test]
    fn ignores_metadata_tags() {
        let parsed = parse_lrc("[ar:MetaPure Lab]\n[ti:Melodist]\n[00:03.00]Only lyrics")
            .expect("metadata should be ignored");

        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].timestamp_ms, 3_000);
        assert_eq!(parsed[0].text, "Only lyrics");
    }

    #[test]
    fn writer_roundtrips_parser_output() {
        let lines = vec![
            LrcLine {
                timestamp_ms: 1_230,
                text: "First line".to_string(),
                translated_text: None,
                word_timestamps: None,
            },
            LrcLine {
                timestamp_ms: 123_400,
                text: "Second line".to_string(),
                translated_text: None,
                word_timestamps: None,
            },
        ];

        let written = write_lrc(&lines);
        let parsed = parse_lrc(&written).expect("written LRC should parse");

        assert_eq!(parsed.len(), lines.len());
        assert_eq!(parsed[0].timestamp_ms, lines[0].timestamp_ms);
        assert_eq!(parsed[0].text, lines[0].text);
        assert_eq!(parsed[1].timestamp_ms, lines[1].timestamp_ms);
        assert_eq!(parsed[1].text, lines[1].text);
    }
}
