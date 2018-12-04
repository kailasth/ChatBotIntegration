let crypto = require('crypto');
const https = require('https');

const EMPLOYEEID_ENTITY = 'EMPLOYEEID';
const EMPLOYEECHATS_ENTITY = 'EMPLOYEECHATS';

const getSequenceNumber = (function() {
  let sequenctNumber = 100000000;
  return function() {
    return sequenctNumber++;
  };
})();

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
    if (employeeId === null) {
      send(callback, 'What is the employee id?');
      return;
    }
    getFolders(callback, { hash: hash })
      .then(response =>
        getInactiveChats(callback, {
          hash: hash,
          folderID: response.folderID,
          employeeId: employeeId
        })
      )
      .then(inactiveChatIds => getChatMessages(callback, { hash: hash, chatIds: inactiveChatIds, employeeId: employeeId }))
      .then(chatMessages => sendResponse(callback, chatMessages,employeeId))
      .catch(err => sendResponse(callback, err,employeeId));
  } catch (err) {
    sendResponse(callback, err,employeeId);
  }
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

function send(callback, requiredField) {
  nano.sendGetEntityResult(callback, null, requiredField);
}

function sendResponse(callback, message,employeeId) {
  const chatsQueryEntity = nano.createEntity({
    kind: EMPLOYEECHATS_ENTITY,
    type: 'text',
    lifecycle: 'statement',
    value: message || 'Technical Error',
    properties: {
      CHATVALUE: message || 'We are currently facing some technical difficulties. Please try again later.',
      CHATSEQUENCE: getSequenceNumber(),
      EMPLOYEEID: employeeId
    }
  });

  nano.sendGetEntityResult(callback, [chatsQueryEntity]);
}

function getEmployeeId(event) {
  let chatDataEntity = nano.getEntity(event, EMPLOYEEID_ENTITY);
  if (chatDataEntity === null || chatDataEntity === undefined) {
    return null;
  }
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
          reject();
          return;
        }
        let folderID = responseData && responseData.Data && responseData.Data[0] && responseData.Data[0].FolderID;
        if (folderID === undefined) {
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
        reject('We could not find any chats with the given employee id: ' + request.employeeId);
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
        resolve(JSON.stringify(responseDataFinal));
        return;
      })
      .catch(err => {
        reject();
        return;
      });
  });
}
