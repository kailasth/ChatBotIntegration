let crypto = require('crypto');
const https = require('https');

const ENTITY_QUERY = 'EMPLOYEECHATS_QUERY';
const ENTITY = 'EMPLOYEECHATS';

const apiConfig = {
  accountId: '730051643012624573',
  apiSettingId: '724837617263768298',
  apiKey: 'ovSOgveRDd18cR9Pc+dbX5JlNReX5Li8'
};

const EMPLOYEE_ID = 'EMPLOYEE_ID';

const getFoldersUrl = 'https://api.boldchat.com/aid/' + apiConfig.accountId + '/data/rest/json/v1/getFolders?auth=';
const getInactiveChatsUrl = 'https://api.boldchat.com/aid/' + apiConfig.accountId + '/data/rest/json/v1/getInactiveChats?auth=';
const getChatMessagesUrl = 'https://api.boldchat.com/aid/' + apiConfig.accountId + '/data/rest/json/v1/getChatMessages?auth=';

exports.handler = handler;

function handler(event, context, callback) {
  try {
    const hash = generateAuthHash();
    const employeeId = getEmployeeId(event);
    const folderID = (await getFolders(callback, { hash: hash })).folderID;
    const inactiveChatIds = (await getInactiveChats(callback, {
      hash: hash,
      folderID: folderID,
      employeeId: employeeId
    }));
    const chatMessages = (await getChatMessages(callback, { hash: hash, chatIds: inactiveChatIds, employeeId: employeeId }));
  } catch(err) {}
}

function formatDate(date) {
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  minutes = minutes < 10 ? '0' + minutes : minutes;
  var strTime = hours + ':' + minutes + ' ' + ampm;
  return date.getMonth() + 1 + '/' + date.getDate() + '/' + date.getFullYear() + '  ' + strTime;
}

function sendResponse(callback, message) {
  const chatsQueryEntity = nano.createEntity({
    kind: ENTITY,
    type: 'text',
    lifecycle: 'statement',
    value: message || 'Technical Error',
    properties: {
      CHATVALUE: message || 'We are currently facing some technical difficulties. Please try again later.'
    }
  });

  nano.sendGetEntityResult(callback, [chatsQueryEntity]);
}

function getEmployeeId(event) {
  let chatDataEntity = nano.getEntity(event, ENTITY_QUERY);
  let employeeId = nano.getPropertyValue(chatDataEntity.properties, EMPLOYEE_ID);
  return employeeId;
}

function generateAuthHash() {
  let timestamp = new Date().getTime();
  let toHash = apiConfig.accountId + ':' + apiConfig.apiSettingId + ':' + timestamp + apiConfig.apiKey;
  let hash = crypto
    .createHash('sha512')
    .update(toHash)
    .digest('hex');
  return apiConfig.accountId + ':' + apiConfig.apiSettingId + ':' + timestamp + ':' + hash;
}

function getFolders(callback, request) {
  return new Promise((resolve, reject) => {
    https.get(getFoldersUrl + request.hash + '&FolderType=5', res => {
      let responseData = '';
      res.on('data', response => {
        responseData += response;
      });
      res.on('end', () => {
        try {
          responseData = JSON.parse(responseData);
        } catch (err) {
          sendResponse(callback);
          reject();
          return;
        }
        let folderID = responseData && responseData.Data && responseData.Data[0] && responseData.Data[0].FolderID;
        if (folderID === undefined) {
          sendResponse(callback);
          reject();
          return;
        } else {
          resolve({ folderID: folderID });
        }
      });
    });
  });
}

function getInactiveChats(callback, request) {
  var chats = [];
  return new Promise((resolve, reject) => {
    https.get(getInactiveChatsUrl + request.hash + '&FolderID=' + request.folderID, res => {
      let responseData = '';
      res.on('data', response => {
        responseData += response;
      });
      res.on('end', () => {
        try {
          responseData = JSON.parse(responseData);
        } catch (err) {
          sendResponse(callback);
          reject();
          return;
        }
        for (let i = 0; i < (responseData && responseData.Data && responseData.Data.length); i++) {
          if (
            responseData.Data[i].CustomFields &&
            responseData.Data[i].CustomFields['Employee ID'] !== undefined &&
            responseData.Data[i].CustomFields['Employee ID'] === request.employeeId
          ) {
            chats.push(responseData.Data[i].ChatID);
          }
        }
        if (chats.length) {
          resolve(chats);
          return;
        }
        sendResponse(callback, 'We could not find any chats with the given employee id: ' + request.employeeId);
        reject();
        return;
      });
    });
  });
}

function getChatMessages(callback, request) {
  return new Promise((resolve, reject) => {
    var chatIds = request.chatIds;
    var promises = [];
    const getChatMessagesForId = chatId => {
      return new Promise((resolve, reject) => {
        https.get(getChatMessagesUrl + request.hash + '&ChatID=' + chatId, res => {
          let responseData = '';
          res.on('data', response => {
            responseData += response;
          });
          res.on('end', () => {
            try {
              responseData = JSON.parse(responseData);
            } catch (err) {
              reject(err);
              return;
            }
            if (responseData && responseData.Status === 'error') {
              reject('Error');
              return;
            }
            resolve(responseData.Data);
            return;
          });
        });
      });
    };

    chatIds.forEach(chatId => {
      promises.push(getChatMessagesForId(chatId));
    });

    Promise.all(promises)
      .then(responseDataFinal => {
        let responseHtml = `<div class="clearfix"></div>The messages for employeeId ${request.employeeId} are: <br /><br />`;
        for (let i = 0; i < responseDataFinal.length; i++) {
          responseHtml += `<div class="chat-block">`;
          for (let j = 0; j < responseDataFinal[i].length; j++) {
            let created = new Date(responseDataFinal[i][j].Created);
            if (responseDataFinal[i][j].PersonType === 1) {
              responseHtml += `<div class ="personType1">${responseDataFinal[i][j].Text}<div class="created-date">${formatDate(
                created
              )}</div></div><div class="clearfix"></div>`;
            } else if (responseDataFinal[i][j].PersonType === 4) {
              responseHtml += `<div class ="personType4">${responseDataFinal[i][j].Text}<div class="created-date">${formatDate(
                created
              )}</div></div><div class="clearfix"></div>`;
            } else {
              responseHtml += `<div class ="pesronType0">${responseDataFinal[i][j].Text}<div class="created-date">${formatDate(
                created
              )}</div></div><div class="clearfix"></div>`;
            }
          }
          responseHtml += `</div>`;
        }
        sendResponse(callback, responseHtml);
        resolve();
        return;
      })
      .catch(err => {
        sendResponse(callback);
        reject();
        return;
      });
  });
}
