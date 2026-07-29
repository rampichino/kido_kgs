// @flow
import type { ConversationMessage } from "../model/types";

// Persists the last few direct-conversation messages per partner so they can be
// shown again after the user logs out and back in. Everything lives in the
// browser (localStorage) — no extra network traffic, and KGS has no protocol
// command to fetch chat history anyway.

const STORAGE_PREFIX = "kido_chat_history:";
const MAX_MESSAGES = 50;
// Cap on how many distinct partner conversations are retained per owner. When
// exceeded, the least-recently-updated conversations are evicted (LRU).
const MAX_CONVERSATIONS = 50;

function storageKey(owner: string, partner: string): string {
  return STORAGE_PREFIX + owner.toLowerCase() + ":" + partner.toLowerCase();
}

type StoredMessage = {
  id: string,
  sender: string,
  body: string,
  date: ?number, // epoch millis; Date isn't JSON-serializable
  announcement?: boolean,
  moderated?: boolean,
};

function toStored(msg: ConversationMessage): StoredMessage {
  let stored: StoredMessage = {
    id: msg.id,
    sender: msg.sender,
    body: msg.body,
    date: msg.date ? msg.date.getTime() : null,
  };
  if (msg.announcement) {
    stored.announcement = true;
  }
  if (msg.moderated) {
    stored.moderated = true;
  }
  return stored;
}

function fromStored(stored: StoredMessage): ConversationMessage {
  let msg: ConversationMessage = {
    id: stored.id,
    sender: stored.sender,
    body: stored.body,
    date: stored.date ? new Date(stored.date) : null,
  };
  if (stored.announcement) {
    msg.announcement = true;
  }
  if (stored.moderated) {
    msg.moderated = true;
  }
  return msg;
}

// Keep only the MAX_CONVERSATIONS most-recently-updated conversations for an
// owner, removing the rest. Entries missing an `updated` stamp (older saves)
// sort oldest so they are evicted first.
function evictOldConversations(owner: string) {
  let prefix = STORAGE_PREFIX + owner.toLowerCase() + ":";
  let entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    let key = localStorage.key(i);
    if (!key || key.indexOf(prefix) !== 0) {
      continue;
    }
    let updated = 0;
    try {
      let parsed = JSON.parse(localStorage.getItem(key) || "");
      if (parsed && typeof parsed.updated === "number") {
        updated = parsed.updated;
      }
    } catch (e) {
      // treat unparseable entries as oldest
    }
    entries.push({ key, updated });
  }
  if (entries.length <= MAX_CONVERSATIONS) {
    return;
  }
  entries.sort((a, b) => b.updated - a.updated);
  for (let stale of entries.slice(MAX_CONVERSATIONS)) {
    localStorage.removeItem(stale.key);
  }
}

// Save the latest messages for a conversation partner, keeping only the most
// recent MAX_MESSAGES. Pending (unsent) messages are skipped.
export function saveChatHistory(
  owner: ?string,
  partner: ?string,
  messages: Array<ConversationMessage>
) {
  if (!owner || !partner) {
    return;
  }
  try {
    let stored = messages
      .filter((m) => !m.sending)
      .slice(-MAX_MESSAGES)
      .map(toStored);
    if (stored.length === 0) {
      return;
    }
    // Keep the partner's real casing alongside the messages; the storage key is
    // lowercased so we can find it again regardless of how the name is typed.
    // `updated` drives LRU eviction once the conversation cap is reached. Saving
    // new messages clears any prior `closed` flag — fresh activity reopens it.
    let payload = { partner, messages: stored, updated: Date.now() };
    localStorage.setItem(storageKey(owner, partner), JSON.stringify(payload));
    evictOldConversations(owner);
  } catch (e) {
    // ignore (quota, disabled storage, etc.)
  }
}

// Saved history for a single conversation partner, or [] when none exists.
export function loadChatHistory(
  owner: ?string,
  partner: ?string
): Array<ConversationMessage> {
  if (!owner || !partner) {
    return [];
  }
  try {
    let raw = localStorage.getItem(storageKey(owner, partner));
    if (!raw) {
      return [];
    }
    let parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.messages)) {
      return parsed.messages.map(fromStored);
    }
  } catch (e) {
    // ignore
  }
  return [];
}

// All stored conversation histories for an owner, as a map of partner name to
// messages. Returns {} when there is nothing saved.
export function loadAllChatHistories(owner: ?string): {
  [partner: string]: Array<ConversationMessage>,
} {
  let result = {};
  if (!owner) {
    return result;
  }
  let prefix = STORAGE_PREFIX + owner.toLowerCase() + ":";
  try {
    for (let i = 0; i < localStorage.length; i++) {
      let key = localStorage.key(i);
      if (!key || key.indexOf(prefix) !== 0) {
        continue;
      }
      let raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      let parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.partner &&
        Array.isArray(parsed.messages) &&
        parsed.messages.length &&
        // Conversations the user explicitly closed are kept on disk (so their
        // history reappears if reopened) but are NOT auto-restored as open chats.
        !parsed.closed
      ) {
        result[parsed.partner] = parsed.messages.map(fromStored);
      }
    }
  } catch (e) {
    // ignore
  }
  return result;
}

// Remove the saved history for a single conversation partner.
export function clearChatHistory(owner: ?string, partner: ?string) {
  if (!owner || !partner) {
    return;
  }
  try {
    localStorage.removeItem(storageKey(owner, partner));
  } catch (e) {
    // ignore
  }
}

// Flag a stored conversation as closed (or reopen it). Closed conversations keep
// their messages but are not auto-restored as open chats on the next login.
export function setChatHistoryClosed(
  owner: ?string,
  partner: ?string,
  closed: boolean
) {
  if (!owner || !partner) {
    return;
  }
  try {
    let key = storageKey(owner, partner);
    let raw = localStorage.getItem(key);
    if (!raw) {
      return;
    }
    let parsed = JSON.parse(raw);
    if (!parsed) {
      return;
    }
    if (closed) {
      parsed.closed = true;
    } else {
      delete parsed.closed;
    }
    localStorage.setItem(key, JSON.stringify(parsed));
  } catch (e) {
    // ignore
  }
}
