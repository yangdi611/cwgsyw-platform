// Flowable moddle extension — enables bpmn-js to parse Flowable template variables like ${groupId}

export const flowableModdleDescriptor = {
  name: 'Flowable',
  uri: 'http://flowable.org/bpmn',
  prefix: 'flowable',
  xml: { tagAlias: 'lowerCase' },
  types: [
    { name: 'CandidateGroups', superClass: ['Element'], properties: [{ name: 'value', type: 'String', isBody: true }] },
    { name: 'CandidateUsers', superClass: ['Element'], properties: [{ name: 'value', type: 'String', isBody: true }] },
    { name: 'Assignee', superClass: ['Element'], properties: [{ name: 'value', type: 'String', isBody: true }] },
  ]
};
