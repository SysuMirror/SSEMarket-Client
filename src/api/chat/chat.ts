import { requestFunc } from '../req'

async function getChatHistory(senderUserID: number, targetUserID: number, threadAnonymous = false) {
  try {
    const res = await requestFunc(
      `/auth/getChatHistory`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        query: {
          senderUserID: senderUserID.toString(),
          targetUserID: targetUserID.toString(),
          threadAnonymous: threadAnonymous ? 'true' : 'false',
        },
      },
    )
    const data = await res!.json()
    return data
  }
  catch (e) {
    console.error(e)
  }
}

async function recallChatMessage(chatMsgID: number) {
  try {
    const res = await requestFunc(
      `/auth/recallChatMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: { chatMsgID },
      },
    )
    return await res!.json()
  }
  catch (e) {
    console.error(e)
  }
}

async function getChatNotice(userID: number) {
  try {
    const res = await requestFunc(
      `/auth/getChatNotice`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        query: {
          userID: userID.toString(),
        },
      },
      true,
    )
    const data = await res!.json()
    return data
  }
  catch (e) {
    console.error(e)
  }
}

async function leaveChatView(senderUserID: number, targetUserID: number, threadAnonymous = false) {
  try {
    const res = await requestFunc(
      `/auth/leaveChatView`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        query: {
          senderUserID: senderUserID.toString(),
          targetUserID: targetUserID.toString(),
          threadAnonymous: threadAnonymous ? 'true' : 'false',
        },
      },
    )
    return await res!.json()
  }
  catch (e) {
    console.error(e)
  }
}

export { getChatHistory, getChatNotice, leaveChatView, recallChatMessage }
