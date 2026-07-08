import "server-only";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function encodeHtmlEntities(value: string) {
  return escapeHtml(value).replace(/[^\x00-\x7F]/g, (character) => {
    const codePoint = character.codePointAt(0);

    return codePoint ? `&#x${codePoint.toString(16).toUpperCase()};` : "";
  });
}

export function assertNoQuestionMarkMojibake(value: string, label: string) {
  if (/\?{3,}/.test(value)) {
    throw new Error(`${label} contains question-mark mojibake`);
  }
}

export function assertAsciiOnly(value: string, label: string) {
  const hasNonAscii = Array.from(value).some((character) => character.codePointAt(0)! > 127);

  if (hasNonAscii) {
    throw new Error(`${label} must be ASCII-only`);
  }
}

export function decodeNumericHtmlEntities(value: string) {
  return value.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
    String.fromCodePoint(Number.parseInt(hex, 16))
  );
}
