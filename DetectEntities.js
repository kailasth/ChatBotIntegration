const EMPLOYEEID_ENTITY = 'EMPLOYEEID';

const EMPLOYEE_ID_MATCH = /^\d{3,}$/;

exports.handler = handler;

function handler(event, context, callback) {
  const employeeId = getEmployeeIdFromTokens(callback, event);
  if (employeeId === undefined) {
    forward(callback);
  } else {
    forwardEmployeeId(callback, employeeId);
  }
}

function forward(callback) {
  nano.sendLambdaResult(callback);
}

function forwardEmployeeId(callback, employeeId) {
  const chatsQueryEntity = nano.createEntity({
    kind: EMPLOYEEID_ENTITY,
    type: 'text',
    lifecycle: 'statement',
    value: EMPLOYEEID_ENTITY,
    matchedToken: EMPLOYEEID_ENTITY,
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
