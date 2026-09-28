// Small things this browser remembers between visits: your name, and the secret token for
// each room you are in, so a refresh puts you back in your seat. Browser storage can be
// unavailable (private windows, blocked storage), so every access is wrapped.

const NAME_KEY = "sa-casino:name";
const tokenKey = (code: string) => `sa-casino:room:${code}`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Not being able to remember is fine; the player just types their name again.
  }
}

export const loadName = () => read(NAME_KEY) ?? "";
export const saveName = (name: string) => write(NAME_KEY, name);

export const loadRoomToken = (code: string) => read(tokenKey(code));
export const saveRoomToken = (code: string, token: string) => write(tokenKey(code), token);
export const forgetRoomToken = (code: string) => write(tokenKey(code), null);
