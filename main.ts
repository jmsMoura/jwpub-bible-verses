import { App, Plugin, PluginSettingTab, Setting, Notice, MarkdownView, Editor, Modal, requestUrl } from 'obsidian';

interface JWPubPluginSettings {
  language: string;
  autoUpdate: boolean;
  updateInterval: number; // in days
  insertLinkOnly: boolean; // Whether to insert only the link without verse content
  linkPrefix: string; // Prefix for the link
  linkSuffix: string; // Suffix for the link
  versePrefix: string; // Prefix for the verse content
  verseSuffix: string; // Suffix for the verse content
  customBookNames: Record<string, string>; // Custom book names mapping - key: book number, value: custom name
  standardAbbreviations: Record<string, string>; // Standard abbreviations for books - key: book number, value: abbreviation
  alternateAbbreviations: Record<string, string>; // Alternate abbreviations for books - key: book number, value: abbreviation
  localizedBookNames: Record<string, Record<string, number>>; // Localized book names by language - key: language, value: mapping of book name to number
  lastLanguageUpdate: Record<string, number>; // Last time book names were updated for a language (timestamp)
}

const DEFAULT_SETTINGS: JWPubPluginSettings = {
  language: 'E', // Default to English
  autoUpdate: true,
  updateInterval: 14, // days
  insertLinkOnly: false, // Default to inserting verses
  linkPrefix: '',
  linkSuffix: '',
  versePrefix: '',
  verseSuffix: '',
  customBookNames: {},
  standardAbbreviations: {},
  alternateAbbreviations: {},
  localizedBookNames: {},
  lastLanguageUpdate: {}
};

// Define the default version of the plugin
export const VERSION = "1.0.0";

// Bible service to handle references and fetching
class BibleService {
  private settings: JWPubPluginSettings;
  
  constructor(settings: JWPubPluginSettings) {
    this.settings = settings;
  }
  
  /**
   * Parse a Bible reference string into a standardized format for JW.org URLs.
   * @param reference The Bible reference (e.g., "John 3:16", "1 Peter 5:7")
   * @returns URL-friendly Bible reference code like "40001001" for Matthews 1:1
   */
  parseReference(reference: string): string | null {
    // Dictionary of book names to their Bible number
    // Include various abbreviations and alternate spellings
    const bibleBooks: Record<string, number> = {
      // Old Testament
      "genesis": 1, "gen": 1, "gn": 1,
      "exodus": 2, "exod": 2, "ex": 2,
      "leviticus": 3, "lev": 3, "lv": 3,
      "numbers": 4, "num": 4, "nm": 4, "nb": 4,
      "deuteronomy": 5, "deut": 5, "dt": 5,
      "joshua": 6, "josh": 6, "jos": 6,
      "judges": 7, "judg": 7, "jdg": 7,
      "ruth": 8, "ru": 8, "rt": 8,
      "1 samuel": 9, "1samuel": 9, "1 sam": 9, "1sam": 9, "1 sa": 9, "1sa": 9,
      "2 samuel": 10, "2samuel": 10, "2 sam": 10, "2sam": 10, "2 sa": 10, "2sa": 10,
      // Add remaining books as needed
      "revelation": 66, "rev": 66, "re": 66, "rv": 66, "apocalypse": 66
    };
    
    // First, normalize the input by removing any periods after book abbreviations
    // and making it lowercase for case-insensitive matching
    const normalizedReference = reference.replace(/\./g, '').toLowerCase().trim();
    
    console.log(`Parsing reference: "${normalizedReference}"`);
    
    // Step 1: Try to identify and extract the book name
    let bookName = '';
    let bookNumber = 0;
    let remainingText = '';
    
    // Sort book names by length (descending) to match longest first
    const sortedBookNames = Object.keys(bibleBooks).sort((a, b) => b.length - a.length);
    
    for (const name of sortedBookNames) {
      if (normalizedReference.startsWith(name) && 
         (normalizedReference.length === name.length || 
          !(/[a-z]/).test(normalizedReference.charAt(name.length)))) { // Make sure it's a full word match
        bookName = name;
        bookNumber = bibleBooks[name];
        remainingText = normalizedReference.substring(name.length).trim();
        break;
      }
    }
    
    if (!bookName || !bookNumber) {
      console.log(`Could not identify book name in: "${normalizedReference}"`);
      return null;
    }
    
    console.log(`Identified book: "${bookName}" (${bookNumber}), remaining text: "${remainingText}"`);
    
    // Step 2: Extract chapter and verse
    // Matches patterns like "1:2", "1:2-3", "1:2,3", etc.
    const chapterVerseRegex = /^(\d+):(\d+)(?:[-,](\d+))?/;
    const chapterVerseMatch = remainingText.match(chapterVerseRegex);
    
    if (!chapterVerseMatch) {
      console.log(`Could not extract chapter and verse from: "${remainingText}"`);
      return null;
    }
    
    const chapter = chapterVerseMatch[1];
    const verse = chapterVerseMatch[2];
    const endVerse = chapterVerseMatch[3]; // Extract end verse if it exists
    
    console.log(`Extracted chapter: ${chapter}, verse: ${verse}${endVerse ? `, end verse: ${endVerse}` : ''}`);
    
    // Format: BBCCCVVV (book, chapter, verse) - e.g., 40001001 for Matthew 1:1
    const paddedBookNumber = bookNumber.toString().padStart(2, '0');
    const paddedChapter = chapter.padStart(3, '0');
    const paddedVerse = verse.padStart(3, '0');
    
    const finalCode = `${paddedBookNumber}${paddedChapter}${paddedVerse}`;
    console.log(`Generated reference code: ${finalCode}`);
    
    // If we have an end verse, include it in the code
    if (endVerse) {
      const paddedEndVerse = endVerse.padStart(3, '0');
      return `${finalCode}-${paddedBookNumber}${paddedChapter}${paddedEndVerse}`;
    }
    
    return finalCode;
  }
  
  /**
   * Generate a JW.org URL for a Bible reference
   * @param referenceCode The Bible reference code (e.g., "40001001" for Matthew 1:1)
   * @returns Full JW.org URL to fetch the Bible verse
   */
  generateUrl(referenceCode: string): string {
    // Check if the reference code contains a range (indicated by a hyphen)
    const isRange = referenceCode.includes('-');
    
    if (isRange) {
      // Split the range into start and end codes
      const [startCode, endCode] = referenceCode.split('-');
      
      // Extract book number from the start code
      const bookNumber = parseInt(startCode.substring(0, 2));
      
      // For books 1-9, remove the leading zero in the URL
      const urlStartCode = bookNumber <= 9 
        ? `${bookNumber}${startCode.substring(2)}` 
        : startCode;
      
      const urlEndCode = bookNumber <= 9 
        ? `${bookNumber}${endCode.substring(2)}` 
        : endCode;
      
      return `https://www.jw.org/finder?wtlocale=${this.settings.language}&bible=${urlStartCode}-${urlEndCode}`;
    } else {
      // Extract book number to check if it's one of the first 9 books
      const bookNumber = parseInt(referenceCode.substring(0, 2));
      
      // For books 1-9, remove the leading zero in the URL
      const urlReferenceCode = bookNumber <= 9 
        ? `${bookNumber}${referenceCode.substring(2)}` 
        : referenceCode;
        
      return `https://www.jw.org/finder?wtlocale=${this.settings.language}&bible=${urlReferenceCode}`;
    }
  }
  
  /**
   * Fetch the Bible verse text from JW.org
   * @param referenceCode Bible reference code
   * @returns The verse text or null if not found
   */
  async fetchVerse(referenceCode: string): Promise<{text: string, reference: string} | null> {
    try {
      // Check if this is a range reference
      const isRange = referenceCode.includes('-');
      let bookNumber, chapter, verse, endVerse, book, formattedReference;
      
      if (isRange) {
        // Split the range into start and end codes
        const [startCode, endCode] = referenceCode.split('-');
        
        // Extract details from the start code
        bookNumber = parseInt(startCode.substring(0, 2));
        chapter = parseInt(startCode.substring(2, 5)).toString();
        verse = parseInt(startCode.substring(5, 8)).toString();
        
        // Extract the end verse from the end code
        endVerse = parseInt(endCode.substring(5, 8)).toString();
        
        book = this.getBookNameFromCode(bookNumber.toString().padStart(2, '0'));
        formattedReference = `${book} ${chapter}:${verse}-${endVerse}`;
        
        console.log(`Fetching verse range: ${formattedReference} with code ${referenceCode}`);
      } else {
        // Extract the book, chapter, and verse from the reference code
        bookNumber = parseInt(referenceCode.substring(0, 2));
        chapter = parseInt(referenceCode.substring(2, 5)).toString();
        verse = parseInt(referenceCode.substring(5, 8)).toString();
        book = this.getBookNameFromCode(bookNumber.toString().padStart(2, '0'));
        formattedReference = `${book} ${chapter}:${verse}`;
        
        console.log(`Fetching verse: ${formattedReference} with code ${referenceCode}`);
      }
      
      // Generate URL for the specific verse or verse range
      const finderUrl = this.generateUrl(referenceCode);
      console.log(`Using URL: ${finderUrl}`);
      
      try {
        const response = await requestUrl({
          url: finderUrl,
          method: 'GET',
          headers: {
            'Accept': 'text/html',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        const html = response.text;
        console.log(`Received HTML response, length: ${html.length}`);
        
        // Extract the verse content from the HTML
        // This is a simplified version - you would need to implement the full extractVerseFromHtml method
        const verseText = this.extractVerseFromHtml(html, bookNumber, verse);
        
        if (verseText) {
          return {
            text: verseText,
            reference: formattedReference
          };
        } else {
          return {
            text: 'Could not extract verse content. Please check the reference and try again.',
            reference: formattedReference
          };
        }
      } catch (error) {
        console.error(`Error accessing URL: ${error}`);
        
        return {
          text: 'Error fetching verse. Please check your connection and try again.',
          reference: formattedReference
        };
      }
    } catch (error) {
      console.error(`Error in fetchVerse: ${error}`);
      return null;
    }
  }
  
  /**
   * Extract verse text from HTML content (simplified)
   * @param html HTML content from JW.org
   * @param bookNumber The book number
   * @param verse The verse number
   * @returns Extracted verse text or null if not found
   */
  private extractVerseFromHtml(html: string, bookNumber: number, verse: string): string | null {
    try {
      // This is a simplified implementation
      // You would need to implement the full HTML parsing logic based on JW.org's structure
      
      // Look for the verse content using simple regex patterns
      const versePattern = new RegExp(`<span[^>]*?class="[^"]*?verse[^"]*?"[^>]*?>([\\s\\S]*?)</span>`, "i");
      const match = html.match(versePattern);
      
      if (match && match[1]) {
        // Clean the HTML to get only the text
        return this.cleanHtmlFragment(match[1]);
      }
      
      return null;
    } catch (error) {
      console.error(`Error extracting verse: ${error}`);
      return null;
    }
  }
  
  /**
   * Clean HTML fragment to extract only the text content (simplified)
   * @param html HTML fragment to clean
   * @returns Cleaned text
   */
  private cleanHtmlFragment(html: string): string {
    // This is a simplified implementation
    // You would need to implement the full HTML cleaning logic
    
    // Remove HTML tags and decode entities
    let text = html
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim();
    
    return text;
  }
  
  /**
   * Get the book name from a book code
   * @param bookCode Two-digit book code
   * @returns Book name or "Unknown Book"
   */
  getBookNameFromCode(bookCode: string): string {
    const bookNumber = parseInt(bookCode);
    
    // Standard book names
    const books = [
      "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
      "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
      "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", 
      "Ezra", "Nehemiah", "Esther", "Job", "Psalms", 
      "Proverbs", "Ecclesiastes", "Song of Solomon", 
      "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel",
      "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah",
      "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah",
      "Malachi", "Matthew", "Mark", "Luke", "John",
      "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians",
      "Ephesians", "Philippians", "Colossians", "1 Thessalonians",
      "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon",
      "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John",
      "3 John", "Jude", "Revelation"
    ];
    
    return bookNumber > 0 && bookNumber <= books.length ? books[bookNumber - 1] : "Unknown Book";
  }
}

export default class JWPubPlugin extends Plugin {
  settings: JWPubPluginSettings = DEFAULT_SETTINGS;
  bibleService!: BibleService;
  
  async onload() {
    await this.loadSettings();
    
    // Initialize the Bible service
    this.bibleService = new BibleService(this.settings);
    
    // Add command to insert Bible verse
    this.addCommand({
      id: 'insert-bible-verse',
      name: 'Insert Bible Verse',
      editorCallback: (editor: Editor) => {
        new BibleReferenceModal(this.app, this, editor).open();
      }
    });
    
    // Add command to insert Bible verse as link
    this.addCommand({
      id: 'insert-bible-verse-link',
      name: 'Insert Bible Verse as Link',
      editorCallback: (editor: Editor) => {
        new BibleReferenceModal(this.app, this, editor, true).open();
      }
    });
    
    // Add settings tab
    this.addSettingTab(new JWPubSettingTab(this.app, this));
  }
  
  onunload() {
    console.log('Unloading JW Bible Verses plugin');
  }
  
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  
  async saveSettings() {
    await this.saveData(this.settings);
  }
  
  /**
   * Insert a Bible verse into the editor
   * @param editor The editor to insert into
   * @param reference The Bible reference string
   */
  async insertBibleVerse(editor: Editor, reference: string) {
    // Parse the reference
    const referenceCode = this.bibleService.parseReference(reference);
    
    if (!referenceCode) {
      new Notice(`Could not parse reference: ${reference}`);
      return;
    }
    
    // Show loading notice
    new Notice(`Fetching verse: ${reference}...`);
    
    try {
      // Fetch the verse
      const result = await this.bibleService.fetchVerse(referenceCode);
      
      if (!result) {
        new Notice(`Could not fetch verse for reference: ${reference}`);
        return;
      }
      
      // Format the verse with customizable prefix/suffix
      const verseBlock = `${this.settings.versePrefix}${result.text}${this.settings.verseSuffix}\n\n— ${result.reference}`;
      
      // Insert at cursor position
      editor.replaceSelection(verseBlock);
      
      new Notice(`Inserted verse: ${result.reference}`);
    } catch (error) {
      new Notice(`Error fetching verse: ${error}`);
    }
  }
  
  /**
   * Insert a Bible verse as a link
   * @param editor The editor to insert into
   * @param reference The Bible reference string
   */
  async insertBibleVerseAsLink(editor: Editor, reference: string) {
    // Parse the reference
    const referenceCode = this.bibleService.parseReference(reference);
    
    if (!referenceCode) {
      new Notice(`Could not parse reference: ${reference}`);
      return;
    }
    
    try {
      // Generate the URL
      const url = this.bibleService.generateUrl(referenceCode);
      
      // Format the link with customizable prefix/suffix
      const link = `${this.settings.linkPrefix}[${reference}](${url})${this.settings.linkSuffix}`;
      
      // Insert at cursor position
      editor.replaceSelection(link);
      
      new Notice(`Inserted link for: ${reference}`);
    } catch (error) {
      new Notice(`Error creating link: ${error}`);
    }
  }
}

/**
 * Bible reference input modal
 */
class BibleReferenceModal extends Modal {
  plugin: JWPubPlugin;
  editor: Editor;
  linkOnly: boolean;
  referenceInput!: HTMLInputElement;
  
  constructor(app: App, plugin: JWPubPlugin, editor: Editor, linkOnly = false) {
    super(app);
    this.plugin = plugin;
    this.editor = editor;
    this.linkOnly = linkOnly;
  }
  
  onOpen() {
    const {contentEl} = this;
    
    contentEl.createEl('h2', {text: 'Insert Bible Verse'});
    
    // Create input field for reference
    contentEl.createEl('p', {text: 'Enter a Bible reference (e.g., "John 3:16", "Genesis 1:1-3"):'});
    
    this.referenceInput = contentEl.createEl('input', {
      type: 'text',
      attr: {
        placeholder: 'Bible reference...',
        autofocus: true
      }
    });
    
    // Add examples
    const exampleText = this.createExampleText();
    contentEl.createEl('p', {
      text: 'Examples:',
      cls: 'example-heading'
    });
    contentEl.createEl('div', {
      text: exampleText,
      cls: 'example-text'
    });
    
    // Add submit button
    const submitButton = contentEl.createEl('button', {
      text: this.linkOnly ? 'Insert as Link' : 'Insert Verse',
      cls: 'mod-cta'
    });
    
    submitButton.addEventListener('click', () => {
      this.submitReference();
    });
    
    // Submit on Enter
    this.referenceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.submitReference();
      }
    });
  }
  
  private submitReference() {
    const reference = this.referenceInput.value.trim();
    
    if (!reference) {
      new Notice('Please enter a Bible reference');
      return;
    }
    
    this.close();
    
    if (this.linkOnly) {
      this.plugin.insertBibleVerseAsLink(this.editor, reference);
    } else {
      this.plugin.insertBibleVerse(this.editor, reference);
    }
  }
  
  private createExampleText(): string {
    return `• John 3:16
• Genesis 1:1-3
• 1 Peter 5:7
• Psalm 23:1
• Matt 5:3-12`;
  }
  
  onClose() {
    const {contentEl} = this;
    contentEl.empty();
  }
}

/**
 * Settings tab
 */
class JWPubSettingTab extends PluginSettingTab {
  plugin: JWPubPlugin;
  
  constructor(app: App, plugin: JWPubPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  
  display(): void {
    const {containerEl} = this;
    
    containerEl.empty();
    
    containerEl.createEl('h2', {text: 'JW Bible Verses Settings'});
    
    // Language setting
    new Setting(containerEl)
      .setName('Language')
      .setDesc('Select the language for Bible verses (see JW.org language codes)')
      .addText(text => text
        .setPlaceholder('E')
        .setValue(this.plugin.settings.language)
        .onChange(async (value) => {
          this.plugin.settings.language = value;
          await this.plugin.saveSettings();
        }));
    
    // Auto-update setting
    new Setting(containerEl)
      .setName('Auto-Update Localized Book Names')
      .setDesc('Automatically update localized book names')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoUpdate)
        .onChange(async (value) => {
          this.plugin.settings.autoUpdate = value;
          await this.plugin.saveSettings();
        }));
    
    // Update interval setting
    new Setting(containerEl)
      .setName('Update Interval (days)')
      .setDesc('Number of days between updates of localized book names')
      .addText(text => text
        .setPlaceholder('14')
        .setValue(this.plugin.settings.updateInterval.toString())
        .onChange(async (value) => {
          const interval = parseInt(value);
          if (!isNaN(interval) && interval > 0) {
            this.plugin.settings.updateInterval = interval;
            await this.plugin.saveSettings();
          }
        }));
    
    // Link-only setting
    new Setting(containerEl)
      .setName('Insert Link Only')
      .setDesc('Insert only the link to the verse, without the verse content')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.insertLinkOnly)
        .onChange(async (value) => {
          this.plugin.settings.insertLinkOnly = value;
          await this.plugin.saveSettings();
        }));
    
    // Formatting section
    containerEl.createEl('h3', {text: 'Formatting Options'});
    
    // Link prefix
    new Setting(containerEl)
      .setName('Link Prefix')
      .setDesc('Text to add before the verse link')
      .addText(text => text
        .setValue(this.plugin.settings.linkPrefix)
        .onChange(async (value) => {
          this.plugin.settings.linkPrefix = value;
          await this.plugin.saveSettings();
        }));
    
    // Link suffix
    new Setting(containerEl)
      .setName('Link Suffix')
      .setDesc('Text to add after the verse link')
      .addText(text => text
        .setValue(this.plugin.settings.linkSuffix)
        .onChange(async (value) => {
          this.plugin.settings.linkSuffix = value;
          await this.plugin.saveSettings();
        }));
    
    // Verse prefix
    new Setting(containerEl)
      .setName('Verse Prefix')
      .setDesc('Text to add before the verse content')
      .addText(text => text
        .setValue(this.plugin.settings.versePrefix)
        .onChange(async (value) => {
          this.plugin.settings.versePrefix = value;
          await this.plugin.saveSettings();
        }));
    
    // Verse suffix
    new Setting(containerEl)
      .setName('Verse Suffix')
      .setDesc('Text to add after the verse content')
      .addText(text => text
        .setValue(this.plugin.settings.verseSuffix)
        .onChange(async (value) => {
          this.plugin.settings.verseSuffix = value;
          await this.plugin.saveSettings();
        }));
  }
} 