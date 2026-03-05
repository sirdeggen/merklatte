export function displayAsIfItWereA32ByteHash(str: string) {
    return str.repeat(64 / str.length);
}