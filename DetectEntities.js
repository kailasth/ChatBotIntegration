const ENTITY_QUERY = 'EMPLOYEECHATS_QUERY';
const ENTITY = 'EMPLOYEECHATS';

const EMPLOYEE_ID_MATCH = /^\d{3,}$/;

exports.handler = handler;

function handler(event, context, callback) {
  const employeeId = getEmployeeIdFromTokens(callback, event);
  if (employeeId === undefined) {
    sendQuestion(callback, 'What is the employee id?');
  } else {
    forwardRequest(callback, employeeId);
  }
}

function sendQuestion(callback, message) {
  const chatsQueryEntity = nano.createEntity({
    kind: ENTITY,
    type: 'text',
    lifecycle: 'statement',
    value: ENTITY,
    matchedToken: ENTITY,
    properties: {
      CHATVALUE: message
    }
  });

  nano.sendLambdaResult(callback, [chatsQueryEntity]);
}

function forwardRequest(callback, employeeId) {
  const chatsQueryEntity = nano.createEntity({
    kind: ENTITY_QUERY,
    type: 'text',
    lifecycle: 'statement',
    value: ENTITY_QUERY,
    matchedToken: ENTITY_QUERY,
    properties: {
      EMPLOYEE_ID: employeeId
    }
  });

  nano.sendLambdaResult(callback, [chatsQueryEntity]);
}

function getEmployeeIdFromTokens(callback, event) {
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
  return employeeId;
}
