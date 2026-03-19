export function displayAsIfItWereA32ByteHash(str: string) {
    if (!str || str.length === 0) {
        return '0'.repeat(64);
    }
    if (str.length >= 64) {
        return str.slice(0, 64);
    }
    // Repeat the string to fill 64 characters
    const repeatCount = Math.ceil(64 / str.length);
    return str.repeat(repeatCount).slice(0, 64);
}