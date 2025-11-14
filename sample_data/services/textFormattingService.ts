const PUNCTUATION_NEED_SPACE = /([\u4e00-\u9fa5])(?![,.!?;:、""''])([\u4e00-\u9fa5])/g;
const MULTIPLE_MARKS = /([,.!?;:])\1+/g;
const PLACEHOLDER_PATTERN = /\{\{[^}]+\}\}/g;

function preservePlaceholders(text: string): { formatted: string; placeholders: string[] } {
    const placeholders: string[] = [];
    const formatted = text.replace(PLACEHOLDER_PATTERN, match => {
        const token = `__PLACEHOLDER_${placeholders.length}__`;
        placeholders.push(match);
        return token;
    });
    return { formatted, placeholders };
}

function restorePlaceholders(text: string, placeholders: string[]): string {
    return placeholders.reduce((acc, original, index) => acc.replace(new RegExp(`__PLACEHOLDER_${index}__`, 'g'), original), text);
}

function insertChineseSpaces(text: string): string {
    return text.replace(/([\u4e00-\u9fa5])(\s*)([A-Za-z0-9])/g, '$1 $3')
               .replace(/([A-Za-z0-9])(\s*)([\u4e00-\u9fa5])/g, '$1 $3');
}

export function autoFormatChineseText(rawText: string): string {
    if (!rawText) {
        return '';
    }

    const { formatted: placeholderSafeText, placeholders } = preservePlaceholders(rawText);

    let formatted = placeholderSafeText
        .replace(/\r\n?/g, '\n')
        .replace(/\u3000/g, ' ');

    formatted = formatted.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n');

    formatted = formatted.replace(/[ \t]{2,}/g, ' ');

    formatted = formatted.replace(PUNCTUATION_NEED_SPACE, '$1$2');

    formatted = formatted.replace(MULTIPLE_MARKS, '$1');

    formatted = insertChineseSpaces(formatted);

    formatted = formatted.trim();

    return restorePlaceholders(formatted, placeholders);
}
