const ENTITY = {
  ENTITY_QUERY: 'EMPLOYEECHATS_QUERY',
  ENTITY: 'EMPLOYEECHATS'
};

const EMPLOYEE_ID_MATCH = /^\d{3,}$/;

const sendMessage = (callback, message) => {
  const chatsQueryEntity = nano.createEntity({
    kind: ENTITY.ENTITY,
    type: 'text',
    lifecycle: 'statement',
    value: ENTITY.ENTITY,
    matchedToken: ENTITY.ENTITY,
    properties: {
      CHATVALUE: message
    }
  });

  nano.sendLambdaResult(callback, [chatsQueryEntity]);
};

const forwardRequest = (callback, employeeId) => {
  const chatsQueryEntity = nano.createEntity({
    kind: ENTITY.ENTITY_QUERY,
    type: 'text',
    lifecycle: 'statement',
    value: ENTITY.ENTITY_QUERY,
    matchedToken: ENTITY.ENTITY_QUERY,
    properties: {
      EMPLOYEE_ID: employeeId
    }
  });

  nano.sendLambdaResult(callback, [chatsQueryEntity]);
};

const checkEmployeeId = (callback, event) => {
  const { tokens } = event;
  let employeeId;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const word = token.word;
    const match = EMPLOYEE_ID_MATCH.exec(word);
    if (match) {
      employeeId = word;
      break;
    }
  }

  if (employeeId === undefined) {
    sendMessage(callback, 'What is the employee id?');
  } else {
    forwardRequest(callback, employeeId);
  }
};

exports.handler = (event, context, callback) => {
  checkEmployeeId(callback, event);
};
