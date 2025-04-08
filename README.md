# JW Bible Verses Plugin for Obsidian

A plugin for Obsidian that allows you to insert and keep up-to-date Bible verses from JW.org in your Obsidian notes.

## Features

- Insert Bible verses from JW.org directly into your notes
- Auto-convert existing Bible references to live linked verses
- Supports multiple languages (configurable via language codes)
- Automatically detects and handles various Bible reference formats
- Supports standard and alternate abbreviations for Bible books
- Keeps verses up-to-date with the latest content from JW.org
- Customizable formatting for verse display
- Works with languages that use diacritics (accented characters)

## Installation

### Manual Installation

1. Download the latest release from the [Releases](https://github.com/jmsMoura/obsidian-jwpub-bible-verses/releases) section
2. Extract the ZIP file to your Obsidian plugins folder: `<vault>/.obsidian/plugins/`
3. Enable the "JW Bible Verses" plugin in Obsidian Settings > Community Plugins

## Usage

### Inserting Bible Verses

1. Click on the book icon in the ribbon or use the command palette to run "Insert Bible Verse"
2. Enter a Bible reference like "John 3:16" or "Genesis 1:1"
3. The verse will be inserted at your cursor position with a link to JW.org

### Converting Existing References

1. Write Bible references in your notes (e.g., "Matthew 5:3", "1 Peter 5:7")
2. Click on the search icon in the ribbon or use the command palette to run "Convert Bible References to Live Verses"
3. Confirm the conversion when prompted
4. All references will be converted to live linked verses

### Supported Reference Formats

The plugin recognizes various Bible reference formats:
- Full book names: "Genesis 1:1", "John 3:16"
- Standard abbreviations: "Gen. 1:1", "Matt. 5:3"
- Alternate abbreviations: "Ge 1:1", "Mt 5:3"
- Numbered books: "1 John 4:8", "2 Peter 1:5-7"
- Compressed numbering: "1Sa 1:1" (without space between number and abbreviation)
- Books with diacritics: "João 3:16", "Gênesis 1:3"

## Configuration

In the plugin settings, you can configure:

### Language Settings
- **Language Code**: Set the language for Bible verses (e.g., "E" for English, "T" for Portuguese)
- **Fetch Book Names**: Download book names in the selected language from JW.org

### Insertion Settings
- **Insert as Link Only**: Insert only the link without the verse content
- **Auto-update Verses**: Automatically update verses when opening notes
- **Update Interval**: How often to check for updates (in days)

### Formatting Options
- **Link Prefix/Suffix**: Add text before/after the reference link
- **Verse Prefix/Suffix**: Add text before/after the verse content

### Bible Book Customization
- **Customize Book Names**: Modify book names, standard and alternate abbreviations
- **Reset to Original**: Restore to original JW.org book names and abbreviations

## Troubleshooting

If verses aren't converting properly:
1. Check your language settings
2. Ensure the references match the expected formats
3. Verify your internet connection (needed to fetch verses)
4. Try refreshing the book names using the "Fetch Book Names" button

## Credits

This plugin uses content from JW.org and is designed for personal use with Obsidian. 
