let crypto = require('crypto');
const https = require('https');
const qs = {
  accountId: '730051643012624573',
  apiSettingId: '724837617263768298',
  apiKey: 'ovSOgveRDd18cR9Pc+dbX5JlNReX5Li8'
};

const ENTITY = {
  ENTITY_QUERY: 'EMPLOYEECHATS_QUERY',
  ENTITY: 'EMPLOYEECHATS'
};

const EMPLOYEE_ID = 'EMPLOYEE_ID';

const getFoldersUrl =
  'https://api.boldchat.com/aid/730051643012624573/data/rest/json/v1/getFolders?auth=';
const getInactiveChatsUrl =
  'https://api.boldchat.com/aid/730051643012624573/data/rest/json/v1/getInactiveChats?auth=';
const getChatMessagesUrl =
  'https://api.boldchat.com/aid/730051643012624573/data/rest/json/v1/getChatMessages?auth=';

function formatDate(date) {
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? '0' + minutes : minutes;
  var strTime = hours + ':' + minutes + ' ' + ampm;
  return date.getMonth() + 1 + '/' + date.getDate() + '/' + date.getFullYear() + '  ' + strTime;
}

const sendMessage = (callback, message) => {
  const chatsQueryEntity = nano.createEntity({
    kind: ENTITY.ENTITY,
    type: 'text',
    lifecycle: 'statement',
    value: message,
    properties: {
      CHATVALUE: message
    }
  });

  nano.sendGetEntityResult(callback, [chatsQueryEntity]);
};

const sendTechnicalErrorMessage = (callback, id) => {
  const chatsQueryEntity = nano.createEntity({
    kind: ENTITY.ENTITY,
    type: 'text',
    lifecycle: 'statement',
    value: 'Technical Error',
    properties: {
      CHATVALUE: 'We are currently facing some technical difficulties. Please try again later.' + id
    }
  });

  nano.sendGetEntityResult(callback, [chatsQueryEntity]);
};

const checkEmployeeId = (callback, event) => {
  let chatDataEntity = nano.getEntity(event, ENTITY.ENTITY_QUERY);
  let employeeId = nano.getPropertyValue(chatDataEntity.properties, EMPLOYEE_ID);
  return Promise.resolve({ employeeId: employeeId });
};

const generateAuthHash = () => {
  let timestamp = new Date().getTime();
  let toHash = qs.accountId + ':' + qs.apiSettingId + ':' + timestamp + qs.apiKey;
  let hash = crypto
    .createHash('sha512')
    .update(toHash)
    .digest('hex');
  return Promise.resolve({
    hash: qs.accountId + ':' + qs.apiSettingId + ':' + timestamp + ':' + hash
  });
};

const getFolders = (callback, request) => {
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
          sendTechnicalErrorMessage(callback, 1);
          reject();
          return;
        }
        let folderID =
          responseData &&
          responseData.Data &&
          responseData.Data[0] &&
          responseData.Data[0].FolderID;
        if (folderID === undefined) {
          sendTechnicalErrorMessage(callback, 2);
          reject();
          return;
        } else {
          resolve({ folderID: folderID });
        }
      });
    });
  });
};

const getInactiveChats = (callback, request) => {
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
          sendTechnicalErrorMessage(callback, 3);
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
        sendMessage(
          callback,
          'We could not find any chats with the given employee id: ' + request.employeeId
        );
        reject();
        return;
      });
    });
  });
};

const getChatMessages = (callback, request) => {
  return new Promise((resolve, reject) => {
    var chatIds = request.chatIds;
    // var responseDataFinal = {
    //   Data : []
    // };
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
        let responseHtml = `<div class="clearfix"></div>The messages for employeeId ${
          request.employeeId
        } are: <br /><br />`;
        for (let i = 0; i < responseDataFinal.length; i++) {
          responseHtml += `<div class="chat-block">`;
          for (let j = 0; j < responseDataFinal[i].length; j++) {
            let created = new Date(responseDataFinal[i][j].Created);
            if (responseDataFinal[i][j].PersonType === 1) {
              responseHtml += `<div class ="personType1">${
                responseDataFinal[i][j].Text
              }<div class="created-date">${formatDate(
                created
              )}</div></div><div class="clearfix"></div>`;
            } else if (responseDataFinal[i][j].PersonType === 4) {
              responseHtml += `<div class ="personType4">${
                responseDataFinal[i][j].Text
              }<div class="created-date">${formatDate(
                created
              )}</div></div><div class="clearfix"></div>`;
            } else {
              responseHtml += `<div class ="pesronType0">${
                responseDataFinal[i][j].Text
              }<div class="created-date">${formatDate(
                created
              )}</div></div><div class="clearfix"></div>`;
            }
          }
          responseHtml += `</div>`;
        }
        sendMessage(callback, responseHtml);
        resolve();
        return;
      })
      .catch(err => {
        sendTechnicalErrorMessage(callback, err);
        reject();
        return;
      });
  });
};

exports.handler = (event, context, callback) => {
  let employeeId;
  let hash;

  checkEmployeeId(callback, event)
    .then(response => {
      employeeId = response.employeeId;
      return generateAuthHash();
    })
    .then(response => {
      hash = response.hash;
      return getFolders(callback, { hash: hash });
    })
    .then(response =>
      getInactiveChats(callback, {
        hash: hash,
        folderID: response.folderID,
        employeeId: employeeId
      })
    )
    .then(response => {
      getChatMessages(callback, { hash: hash, chatIds: response, employeeId: employeeId });
    })
    .catch(err => {});
};
