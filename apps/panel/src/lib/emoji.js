// utilities to convert country codes / shortcodes into emoji flags
export const getCountryFlagEmoji = (countryCode) => {
    if (!countryCode) return '';
    const code = String(countryCode).toUpperCase().slice(0, 2);
    const codePoints = code
        .split("")
        .map((char) => 127397 + char.charCodeAt(0));
    try {
        return String.fromCodePoint(...codePoints);
    } catch (e) {
        return '';
    }
};

// Replace :IR: style shortcodes with flag emoji. Keeps other text as-is.
export const convertEmojiShortcodes = (text) => {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/:([A-Za-z]{2}):/g, (_, code) => getCountryFlagEmoji(code));
};

export default {
    getCountryFlagEmoji,
    convertEmojiShortcodes
};
