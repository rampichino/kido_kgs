// @flow
import { v4 as uuidV4 } from "uuid";
import { isTempId } from "./tempId";
import { saveChatHistory } from "../util/chatHistory";
import { InvariantError } from "../util/error";
import type {
  AppState,
  KgsMessage,
  Conversation,
  ChannelMembership,
  ConversationMessage,
  Index,
} from "./types";

function createConversation(msg: KgsMessage, selfName: ?string) {
  if (!msg.channelId) {
    throw new InvariantError("Missing channelId");
  }
  let convo: Conversation = {
    id: msg.channelId,
    messages: Array.isArray(msg.messages) ? msg.messages : [],
    status: isTempId(msg.channelId) ? "pending" : "created",
  };
  if (msg.callbackKey) {
    convo.callbackKey = msg.callbackKey;
  }
  // The conversation's `user` is the *partner* — never the current user. A CHAT
  // echo of our own message has `msg.user` = us, so guarding against self here
  // prevents the conversation's partner from being clobbered with our own name
  // (which broke presence tracking: the "not delivered" timeout would mark our
  // own status unknown instead of the partner's).
  if (msg.user && msg.user.name !== selfName) {
    convo.user = msg.user.name;
  }
  return convo;
}

export function handleConversationMessage(
  prevState: AppState,
  msg: KgsMessage
): AppState {
  let chanId = msg.channelId;
  if (
    (msg.type === "CONVO_JOIN" ||
      msg.type === "ROOM_JOIN" ||
      msg.type === "CHALLENGE_JOIN") &&
    chanId
  ) {
    let conversationsById: Index<Conversation> = {
      ...prevState.conversationsById,
    };
    let selfName = prevState.currentUser && prevState.currentUser.name;
    let convo = createConversation(msg, selfName);

    let tempConvoId;
    if (msg.callbackKey) {
      tempConvoId = Object.keys(conversationsById).find(
        (cid) =>
          isTempId(conversationsById[cid].id) &&
          conversationsById[cid].callbackKey === msg.callbackKey
      );
    }
    // Fall back to matching a dormant conversation (e.g. history restored after
    // login) by partner name. This covers the case where the *partner* opens
    // the chat first: no callbackKey was set on our side, so without this match
    // a duplicate channel would be created and the restored history orphaned.
    if (!tempConvoId && convo.user) {
      let partner = convo.user.toLowerCase();
      tempConvoId = Object.keys(conversationsById).find((cid) => {
        let c = conversationsById[cid];
        return isTempId(c.id) && c.user && c.user.toLowerCase() === partner;
      });
    }
    if (tempConvoId) {
      tempConvoId = parseInt(tempConvoId, 10);
      let prevConvo = conversationsById[tempConvoId];
      convo = { ...prevConvo, ...convo };
      // Keep any messages the temp/dormant conversation already had (e.g.
      // history restored after login) — createConversation starts them empty.
      if (prevConvo.messages && prevConvo.messages.length) {
        convo.messages = prevConvo.messages;
      }
      delete conversationsById[tempConvoId];
    }
    conversationsById[chanId] = convo;

    let nextState = { ...prevState, conversationsById };

    // Channel membership
    if (msg.type === "CONVO_JOIN") {
      let chanMem: ChannelMembership = { ...prevState.channelMembership };
      chanMem[chanId] = { type: "conversation", complete: false, stale: false };
      if (tempConvoId) {
        delete chanMem[tempConvoId];
      }
      nextState.channelMembership = chanMem;
    }

    if (msg.joinNow) {
      nextState.activeConversationId = convo.id;
      nextState.userDetailsRequest = null;
    } else if (tempConvoId && prevState.activeConversationId === tempConvoId) {
      nextState.activeConversationId = chanId;
    }

    return nextState;
  } else if (
    (msg.type === "CHAT" ||
      msg.type === "ANNOUNCE" ||
      msg.type === "MODERATED_CHAT") &&
    chanId
  ) {
    let conversationsById: Index<Conversation> = {
      ...prevState.conversationsById,
    };
    if (!conversationsById[chanId]) {
      let selfName = prevState.currentUser && prevState.currentUser.name;
      conversationsById[chanId] = createConversation(msg, selfName);
    }
    let convoMsg: ConversationMessage = {
      id: msg.messageId || uuidV4(),
      sender: msg.user.name,
      body: msg.text,
      date: new Date(),
    };
    if (msg.type === "ANNOUNCE") {
      convoMsg.announcement = true;
    }
    if (msg.type === "MODERATED_CHAT") {
      convoMsg.moderated = true;
    }
    let messages;
    if (msg.sending) {
      convoMsg.sending = true;
      messages = [...conversationsById[chanId].messages];
    } else {
      // Match the optimistic copy of this message by text + sender so the echo
      // replaces it instead of duplicating. This also self-heals a message that
      // the send timeout already (wrongly) flagged "Not delivered": if the echo
      // finally arrives, drop that flag — the message WAS delivered, the echo
      // was just slow.
      let matchingMsg = conversationsById[chanId].messages.find(
        (m) =>
          (m.sending || m.notDelivered) &&
          m.body === convoMsg.body &&
          m.sender === convoMsg.sender
      );
      if (matchingMsg) {
        let matchingId = matchingMsg.id;
        messages = conversationsById[chanId].messages.filter(
          (m) => m.id !== matchingId
        );
        convoMsg.date = matchingMsg.date;
      } else {
        messages = [...conversationsById[chanId].messages];
      }
    }
    messages.push(convoMsg);
    let newConvo: Conversation = {
      ...conversationsById[chanId],
      messages,
    };
    // Own outgoing messages (optimistic copy and server echo) must not bump
    // the unread badge.
    let isSelf =
      prevState.currentUser &&
      convoMsg.sender === prevState.currentUser.name &&
      !convoMsg.announcement;
    let isUnseen =
      !isSelf &&
      (prevState.nav !== "chat" ||
        prevState.activeConversationId !== newConvo.id);
    if (isUnseen) {
      newConvo.unseenCount = (newConvo.unseenCount || 0) + 1;
    }
    conversationsById[chanId] = newConvo;
    // Persist direct-conversation history so it survives logout. Only 1:1
    // conversations (those with a partner `user`) are kept, not rooms.
    if (newConvo.user && prevState.currentUser) {
      saveChatHistory(prevState.currentUser.name, newConvo.user, messages);
    }
    return { ...prevState, conversationsById };
  } else if (msg.type === "ANNOUNCEMENT") {
    // Global announcement - add to all conversations
    let convoMsg: ConversationMessage = {
      id: uuidV4(),
      sender: msg.user && msg.user.name,
      body: msg.text,
      date: new Date(),
      announcement: true,
    };
    let conversationsById: Index<Conversation> = {
      ...prevState.conversationsById,
    };
    for (let convoId of Object.keys(conversationsById)) {
      conversationsById[convoId] = {
        ...conversationsById[convoId],
        messages: [...conversationsById[convoId].messages, convoMsg],
      };
    }
    return { ...prevState, conversationsById };
  } else if (msg.type === "CONVO_NO_SUCH_USER") {
    // TODO
  } else if (msg.type === "CLOSE_CONVERSATION") {
    let convoId = msg.conversationId;
    let conversationsById: Index<Conversation> = {
      ...prevState.conversationsById,
    };
    if (conversationsById[convoId]) {
      conversationsById[convoId] = {
        ...conversationsById[convoId],
        status: "closed",
      };
      let nextState = { ...prevState, conversationsById };
      if (prevState.activeConversationId === convoId) {
        nextState.activeConversationId = null;
      }
      return nextState;
    }
  } else if (msg.type === "CHAT_RESOLVE_PENDING") {
    // A send timed out with no server echo: stop showing "Sending..." on the
    // optimistic message. If the recipient was offline at send time, flag it as
    // undelivered; otherwise assume the echo was simply lost and resolve it to
    // a normal sent message.
    let convoId = msg.conversationId;
    let conversationsById: Index<Conversation> = {
      ...prevState.conversationsById,
    };
    let convo = conversationsById[convoId];
    if (convo) {
      let target = convo.messages.find(
        (m) => m.id === msg.messageId && m.sending
      );
      if (target) {
        let resolved = { ...target, sending: false };
        if (msg.notDelivered) {
          resolved.notDelivered = true;
        }
        conversationsById[convoId] = {
          ...convo,
          messages: convo.messages.map((m) =>
            m.id === msg.messageId ? resolved : m
          ),
        };
        return { ...prevState, conversationsById };
      }
    }
  } else if (msg.type === "CLEAR_CONVERSATION_HISTORY") {
    let convoId = msg.conversationId;
    let conversationsById: Index<Conversation> = {
      ...prevState.conversationsById,
    };
    if (conversationsById[convoId]) {
      conversationsById[convoId] = {
        ...conversationsById[convoId],
        messages: [],
      };
      return { ...prevState, conversationsById };
    }
  } else if (msg.type === "CONVO_REVIVE") {
    // A dormant conversation restored from history is being revived: stamp it
    // with the callbackKey of the CONVO_REQUEST so the incoming CONVO_JOIN
    // merges into it (preserving the restored messages) instead of creating a
    // duplicate channel.
    let convoId = msg.conversationId;
    let conversationsById: Index<Conversation> = {
      ...prevState.conversationsById,
    };
    if (conversationsById[convoId]) {
      conversationsById[convoId] = {
        ...conversationsById[convoId],
        callbackKey: msg.callbackKey,
      };
      return { ...prevState, conversationsById };
    }
  } else if (msg.type === "CONVERSATION_CHANGE") {
    return {
      ...prevState,
      activeConversationId: msg.conversationId,
    };
  } else if (msg.type === "SAW_CONVERSATION") {
    let convoId = msg.conversationId;
    let conversationsById: Index<Conversation> = {
      ...prevState.conversationsById,
    };
    if (conversationsById[convoId]) {
      conversationsById[convoId] = {
        ...conversationsById[convoId],
        lastSeen: Date.now(),
        unseenCount: 0,
      };
      return { ...prevState, conversationsById };
    }
  }
  return prevState;
}
