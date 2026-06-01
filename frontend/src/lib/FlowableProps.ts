import { TextFieldEntry, isTextFieldEntryEdited } from '@bpmn-io/properties-panel';
import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';

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

function getFE(element: any, typeName: string): any {
  const ee = element.get('extensionElements');
  if (!ee) return null;
  return (ee.get('values') || []).find((v: any) => v.$type === `flowable:${typeName}`) || null;
}

function getFV(element: any, typeName: string): string {
  const el = getFE(element, typeName);
  return el ? (el.get('value') || '') : '';
}

export default class FlowablePropertiesProvider {
  static $inject = ['propertiesPanel', 'injector'];

  private _injector: any;

  constructor(propertiesPanel: any, injector: any) {
    propertiesPanel.registerProvider(500, this);
    this._injector = injector;
  }

  getGroups(element: any) {
    return (groups: any[]) => {
      const bo = getBusinessObject(element);
      if (!is(bo, 'bpmn:UserTask')) return groups;

      const modeling = this._injector.get('modeling');
      const bpmnFactory = this._injector.get('bpmnFactory');

      const setVal = (typeName: string, value: string) => {
        const ee = bo.get('extensionElements');
        const existing = getFE(bo, typeName);

        if (!value) {
          if (existing && ee) {
            const newVals = ee.get('values').filter((v: any) => v !== existing);
            modeling.updateModdleProperties(element, bo, {
              extensionElements: newVals.length ? undefined : undefined
            });
            // Simpler: directly update
            bo.set('extensionElements', bpmnFactory.create('bpmn:ExtensionElements', { values: newVals }));
          }
          modeling.updateProperties(element, {});
          return;
        }

        if (existing) {
          modeling.updateModdleProperties(element, existing, { value });
        } else {
          const newEl = bpmnFactory.create(`flowable:${typeName}`, { value });
          const newVals = ee ? [...ee.get('values'), newEl] : [newEl];
          const extEl = bpmnFactory.create('bpmn:ExtensionElements', { values: newVals });
          modeling.updateModdleProperties(element, bo, { extensionElements: extEl });
        }
      };

      const entry = (id: string, label: string, typeName: string, desc: string) => ({
        id, element, label, description: desc,
        getValue: () => getFV(bo, typeName),
        setValue: (v: string) => setVal(typeName, v),
        component: TextFieldEntry,
        isEdited: isTextFieldEntryEdited,
      });

      groups.push({
        id: 'flowable-assignment',
        label: 'Flowable Assignment',
        entries: [
          entry('fbe', 'Assignee', 'Assignee', 'User ID of assignee'),
          entry('fcu', 'Candidate Users', 'CandidateUsers', 'Comma-separated user IDs'),
          entry('fcg', 'Candidate Groups', 'CandidateGroups', '${groupId} or comma-separated IDs'),
        ],
      });

      return groups;
    };
  }
}
