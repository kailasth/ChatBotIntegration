const crypto = require('crypto');
const https = require('https');

const EMPLOYEEID_ENTITY = 'EMPLOYEEID';
const EMPLOYEECHATS_ENTITY = 'EMPLOYEECHATS';

const API_CONFIG = {
  accountId: '730051643012624573',
  apiSettingId: '724837617263768298',
  apiKey: 'ovSOgveRDd18cR9Pc+dbX5JlNReX5Li8'
};

const PROPERTY_EMPLOYEE_ID = 'EMPLOYEE_ID';

const getFoldersUrl = 'https://api.boldchat.com/aid/' + API_CONFIG.accountId + '/data/rest/json/v1/getFolders?auth=';
const getInactiveChatsUrl = 'https://api.boldchat.com/aid/' + API_CONFIG.accountId + '/data/rest/json/v1/getInactiveChats?auth=';
const getChatMessagesUrl = 'https://api.boldchat.com/aid/' + API_CONFIG.accountId + '/data/rest/json/v1/getChatMessages?auth=';

const getSequenceNumber = (function() {
  const uniqueKey = parseInt(Math.random() * Number.MAX_SAFE_INTEGER);
  let sequenctNumber = 100000000;
  return function() {
    return uniqueKey + '-' + sequenctNumber++;
  };
})();

exports.handler = handler;

function handler(event, context, callback) {
  try {
    const hash = generateAuthHash();
    const employeeId = getEmployeeId(event);
    if (employeeId === null) {
      return sendErrorMessage(callback, 'What is the employee id?');
    }
    getFolders({ hash: hash })
      .then(response =>
        getInactiveChats({
          hash: hash,
          folderID: response.folderID,
          employeeId: employeeId
        })
      )
      .then(inactiveChatIds => getChatMessages({ hash: hash, chatIds: inactiveChatIds, employeeId: employeeId }))
      .then(chatMessages => sendResponse(callback, chatMessages, employeeId, 'json'))
      .catch(err => sendResponse(callback, err, employeeId, 'string'));
  } catch (err) {
    sendResponse(callback, err, employeeId, 'string');
  }
}

function sendErrorMessage(callback, question) {
  nano.sendGetEntityResult(callback, null, question);
}

function sendResponse(callback, message, employeeId, type) {
  const chatsQueryEntity = nano.createEntity({
    kind: EMPLOYEECHATS_ENTITY,
    type: 'text',
    lifecycle: 'statement',
    value: message || 'Technical Error',
    properties: {
      MESSAGETYPE: type,
      CHATVALUE: message || 'We are currently facing some technical difficulties. Please try again later.',
      CHATSEQUENCE: getSequenceNumber(),
      EMPLOYEEID: employeeId
    }
  });
  nano.sendGetEntityResult(callback, [chatsQueryEntity]);
}

function getEmployeeId(event) {
  const chatDataEntity = nano.getEntity(event, EMPLOYEEID_ENTITY);
  if (chatDataEntity === null || chatDataEntity === undefined) {
    return null;
  }
  return nano.getPropertyValue(chatDataEntity.properties, PROPERTY_EMPLOYEE_ID);
}

function generateAuthHash() {
  const timestamp = new Date().getTime();
  const digestInput = API_CONFIG.accountId + ':' + API_CONFIG.apiSettingId + ':' + timestamp;
  const toHash = digestInput + API_CONFIG.apiKey;
  const hash = crypto
    .createHash('sha512')
    .update(toHash)
    .digest('hex');
  return digestInput + ':' + hash;
}

function getFolders(request) {
  return new Promise((resolve, reject) => {
    const folderType = 5;
    https.get(getFoldersUrl + request.hash + '&FolderType=' + folderType, res => {
      let responseData = '';
      res.on('data', chunk => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          responseData = JSON.parse(responseData);
        } catch (err) {
          return reject();
        }
        const folderID = responseData && responseData.Data && responseData.Data[0] && responseData.Data[0].FolderID;
        if (folderID === undefined) {
          reject();
        } else {
          resolve({ folderID: folderID });
        }
      });
    });
  });
}

function getInactiveChats(request) {
  const chats = [];
  return new Promise((resolve, reject) => {
    https.get(getInactiveChatsUrl + request.hash + '&FolderID=' + request.folderID, res => {
      let responseData = '';
      res.on('data', chunk => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          responseData = JSON.parse(responseData);
        } catch (err) {
          return reject();
        }
        responseData &&
          responseData.Data &&
          Array.isArray(responseData.Data) &&
          responseData.Data.forEach(Data => {
            if (Data.CustomFields && Data.CustomFields['Employee ID'] !== undefined && Data.CustomFields['Employee ID'] === request.employeeId) {
              chats.push(Data.ChatID);
            }
          });
        if (chats.length) {
          resolve(chats);
        } else {
          reject('We could not find any chats with the given employee id: ' + request.employeeId);
        }
      });
    });
  });
}

function getChatMessages(request) {
  return new Promise((resolve, reject) => {
    const { chatIds } = request;
    const promises = [];
    function getChatMessagesForId(chatId) {
      return new Promise((resolve, reject) => {
        https.get(getChatMessagesUrl + request.hash + '&ChatID=' + chatId, res => {
          let responseData = '';
          res.on('data', chunk => {
            responseData += chunk;
          });
          res.on('end', () => {
            try {
              responseData = JSON.parse(responseData);
            } catch (err) {
              return reject(err);
            }
            if (responseData && responseData.Status === 'error') {
              reject('Error');
            } else {
              resolve(responseData.Data);
            }
          });
        });
      });
    }

    chatIds.forEach(chatId => promises.push(getChatMessagesForId(chatId)));

    Promise.all(promises)
      .then(responseDataFinal => resolve(JSON.stringify(responseDataFinal)))
      .catch(() => reject());
  });
}
