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

const sendTechnicalErrorMessage = callback => {
  const chatsQueryEntity = nano.createEntity({
    kind: ENTITY.ENTITY,
    type: 'text',
    lifecycle: 'statement',
    value: 'Technical Error',
    properties: {
      CHATVALUE: 'We are currently facing some technical difficulties. Please try again later.'
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
          sendTechnicalErrorMessage(callback);
          reject();
          return;
        }
        let folderID =
          responseData &&
          responseData.Data &&
          responseData.Data[0] &&
          responseData.Data[0].FolderID;
        if (folderID === undefined) {
          sendTechnicalErrorMessage(callback);
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
          sendTechnicalErrorMessage(callback);
          reject();
          return;
        }
        for (let i = 0; i < (responseData && responseData.Data && responseData.Data.length); i++) {
          if (
            responseData.Data[i].CustomFields &&
            responseData.Data[i].CustomFields['Employee ID'] !== undefined &&
            responseData.Data[i].CustomFields['Employee ID'] === request.employeeId
          ) {
            resolve({ chatId: responseData.Data[i].ChatID });
            return;
          }
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
    https.get(getChatMessagesUrl + request.hash + '&ChatID=' + request.chatId, res => {
      let responseData = '';
      res.on('data', response => {
        responseData += response;
      });
      res.on('end', () => {
        try {
          responseData = JSON.parse(responseData);
        } catch (err) {
          sendTechnicalErrorMessage(callback);
          reject();
          return;
        }
        if (responseData && responseData.Status === 'error') {
          sendMessage(callback, 'We could not find any chats for the given id.');
          resolve();
          return;
        }
        let responseHtml = `The messages for employeeId ${request.employeeId} are: <br /><br />`;
        for (let i = 0; i < responseData.Data.length; i++) {
          if (responseData.Data[i].PersonType === 1) {
            responseHtml += `<div style="display: block; width: 70%; text-align: right; margin-left: 27%; background-color: #28a06d; color: #fff; padding: 5px; border-radius: 10px 0px 0px 10px; margin-top: 5px; padding-right: 15px;">${
              responseData.Data[i].Text
            }</div>`;
          } else if (responseData.Data[i].PersonType === 4) {
            responseHtml += `<div style ="text-allign: left; display: block; width: 70%;  text-align: left; background-color: #eb7600; color: #fff; padding: 5px; border-radius: 0px 10px 10px 0px; margin-top: 5px; margin-left: -15px; padding-left: 15px;">${
              responseData.Data[i].Text
            }</div>`;
          } else {
            responseHtml += `<div style ="text-allign: left; display: block; width: 70%;  text-align: left; background-color: #5f7e7d; color: #fff; padding: 5px; border-radius: 0px 10px 10px 0px; margin-top: 5px; margin-left: -15px; padding-left: 15px;">${
              responseData.Data[i].Text
            }</div>`;
          }
        }
        sendMessage(callback, responseHtml);
        resolve();
        return;
      });
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
    .then(response =>
      getChatMessages(callback, { hash: hash, chatId: response.chatId, employeeId: employeeId })
    )
    .catch(err => {});
};
